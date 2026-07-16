// งานตามเวลา (cron): ตัดรอบเที่ยงคืน + ส่งรายการตรวจให้ผู้ตรวจตอน 16:30
import { prisma } from "@/lib/db";
import { fmtDate, fmtDateTime } from "@/lib/date";
import {
  pushMessage,
  buildInspectorListMessage,
  buildReminderMessage,
  buildExecutiveSummaryMessage,
} from "@/lib/lineMessaging";
import { getExecutiveReport } from "@/lib/report";

function dayRange(d: Date) {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

// สถานะที่ถือว่า "ปฏิบัติงานแล้ว" (มีการส่งงาน) — ไม่นับว่าขาด
// รวม NOT_REVIEWED ด้วย: ส่งงานแล้วแต่ตัดรอบเพราะผู้ตรวจไม่ได้ตรวจ → ถือว่าทำงานแล้ว
const PERFORMED: ("SUBMITTED" | "APPROVED" | "REJECTED" | "NOT_REVIEWED")[] = [
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "NOT_REVIEWED",
];

// ตัดรอบ: งานที่มอบหมาย (รายวัน + งานประจำ) ของวันที่กำหนด (ค่าเริ่มต้น = เมื่อวาน)
// ถ้ายังไม่ได้ส่งงาน → ทำเครื่องหมาย MISSED ("ไม่ได้ปฏิบัติงาน")
export async function runMidnightCutoff(
  forDate?: Date
): Promise<{ marked: number }> {
  const target = forDate ?? new Date(Date.now() - 24 * 60 * 60 * 1000); // เมื่อวาน
  const { start, end } = dayRange(target);
  const dow = start.getDay();

  // เป้าหมายงานของวันนั้น: assignment รายวัน + schedule ที่ตรงวันของสัปดาห์
  const [assignments, schedules] = await Promise.all([
    prisma.assignment.findMany({
      where: { scheduledDate: { gte: start, lt: end } },
      select: { id: true, userId: true, checkpointId: true },
    }),
    prisma.schedule.findMany({
      where: { active: true, daysOfWeek: { has: dow } },
      select: { userId: true, checkpointId: true },
    }),
  ]);

  // รวมเป็นเป้าหมาย (userId+checkpointId) ไม่ซ้ำ; เก็บ assignmentId ถ้ามี
  const targets = new Map<
    string,
    { userId: string; checkpointId: string; assignmentId?: string }
  >();
  for (const a of assignments) {
    const key = `${a.userId}_${a.checkpointId}`;
    if (!targets.has(key))
      targets.set(key, {
        userId: a.userId,
        checkpointId: a.checkpointId,
        assignmentId: a.id,
      });
  }
  for (const s of schedules) {
    const key = `${s.userId}_${s.checkpointId}`;
    if (!targets.has(key))
      targets.set(key, { userId: s.userId, checkpointId: s.checkpointId });
  }

  if (targets.size === 0) return { marked: 0 };

  // บันทึกงานของวันนั้นทั้งหมด (ของ user ที่เกี่ยวข้อง)
  const userIds = [...new Set([...targets.values()].map((t) => t.userId))];
  const records = await prisma.workRecord.findMany({
    where: { userId: { in: userIds }, checkInAt: { gte: start, lt: end } },
    select: { id: true, userId: true, checkpointId: true, status: true },
  });
  const recByKey = new Map<string, typeof records>();
  for (const r of records) {
    const key = `${r.userId}_${r.checkpointId}`;
    const arr = recByKey.get(key) ?? [];
    arr.push(r);
    recByKey.set(key, arr);
  }

  let marked = 0;
  for (const [key, t] of targets) {
    const recs = recByKey.get(key) ?? [];
    // ถ้ามีงานที่ส่งแล้ว (หรือ MISSED อยู่แล้ว) → ข้าม
    if (recs.some((r) => PERFORMED.includes(r.status as never))) continue;
    if (recs.some((r) => r.status === "MISSED")) continue;

    const inProgress = recs.find((r) => r.status === "IN_PROGRESS");
    if (inProgress) {
      await prisma.workRecord.update({
        where: { id: inProgress.id },
        data: { status: "MISSED" },
      });
      marked++;
    } else {
      await prisma.workRecord.create({
        data: {
          userId: t.userId,
          checkpointId: t.checkpointId,
          assignmentId: t.assignmentId,
          status: "MISSED",
          checkInAt: start,
        },
      });
      marked++;
    }
  }

  console.log(`[jobs] ตัดรอบ ${fmtDate(start)} → MISSED ${marked} รายการ`);
  return { marked };
}

// ตัดรอบงานรอตรวจ (เรียก 17:00 ทุกวัน): งานที่ยัง SUBMITTED ("รอตรวจ")
// → เปลี่ยนเป็น NOT_REVIEWED ("ไม่ได้รับการตรวจ"). ผู้ตรวจยังเปิดตรวจย้อนหลังได้
// (review API อนุญาตทั้ง SUBMITTED + NOT_REVIEWED → กลับเป็น APPROVED/REJECTED)
export async function runReviewCutoff(): Promise<{ marked: number }> {
  const result = await prisma.workRecord.updateMany({
    where: { status: "SUBMITTED" },
    data: { status: "NOT_REVIEWED" },
  });
  console.log(`[jobs] ตัดรอบรอตรวจ → NOT_REVIEWED ${result.count} รายการ`);
  return { marked: result.count };
}

// ส่งรายการที่ต้องตรวจ (งานสถานะ SUBMITTED) ให้ผู้ตรวจทุกคน
// (ไม่มีการระบุผู้ตรวจล่วงหน้าแล้ว — ทุกคนได้รายการเดียวกัน ใครว่างก็ตรวจได้)
export async function sendInspectorDailyList(): Promise<{ sent: number }> {
  const pending = await prisma.workRecord.findMany({
    where: { status: "SUBMITTED" },
    include: {
      user: true,
      checkpoint: { include: { site: true } },
    },
    orderBy: { submittedAt: "asc" },
  });

  if (pending.length === 0) {
    console.log("[jobs] ไม่มีงานรอตรวจ — ไม่ส่งรายการ");
    return { sent: 0 };
  }

  const inspectors = await prisma.user.findMany({
    where: { role: "INSPECTOR", active: true, lineUserId: { not: null } },
    select: { lineUserId: true },
  });

  const dateStr = fmtDate(new Date());
  const items = pending.map((r) => ({
    siteName: r.checkpoint.site.name,
    checkpointName: r.checkpoint.name,
    staffName: r.user.name,
    timeStr: r.submittedAt ? fmtDateTime(r.submittedAt) : "",
  }));
  const msg = buildInspectorListMessage({ dateStr, items });

  let sent = 0;
  for (const ins of inspectors) {
    if (ins.lineUserId && (await pushMessage(ins.lineUserId, [msg]))) sent++;
  }
  console.log(`[jobs] ส่งรายการตรวจให้ผู้ตรวจ ${sent} คน`);
  return { sent };
}

// ส่งสรุปรายงานผู้บริหารเข้า LINE ให้ ADMIN ทุกคนที่ผูก LINE
export async function sendExecutiveSummary(
  from: Date,
  to: Date,
  label: string
): Promise<{ sent: number }> {
  const report = await getExecutiveReport(from, to);
  const admins = await prisma.user.findMany({
    where: {
      role: { in: ["ADMIN", "EXECUTIVE"] },
      active: true,
      lineUserId: { not: null },
    },
    select: { lineUserId: true },
  });
  if (admins.length === 0) return { sent: 0 };

  const msg = buildExecutiveSummaryMessage({
    periodLabel: label,
    total: report.kpi.total,
    attendanceRate: report.kpi.attendanceRate,
    passRate: report.kpi.passRate,
    missed: report.kpi.missed,
    pending: report.kpi.pending,
    issuesOpenNow: report.issues.openNow,
  });

  let sent = 0;
  for (const a of admins) {
    if (a.lineUserId && (await pushMessage(a.lineUserId, [msg]))) sent++;
  }
  console.log(`[jobs] ส่งรายงานผู้บริหาร (${label}) → ${sent} คน`);
  return { sent };
}

// ช่วง "เดือนก่อน" (สำหรับส่งอัตโนมัติต้นเดือน)
export function previousMonthRange(now: Date = new Date()): {
  from: Date;
  to: Date;
  label: string;
} {
  const to = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
  const label = `เดือน ${from.toLocaleDateString("th-TH", {
    month: "long",
    year: "numeric",
  })}`;
  return { from, to, label };
}

// เตือน "ถึงเวลาเริ่มงาน" — เรียกทุกนาที (งานวันนี้/งานประจำที่ startTime == เวลาปัจจุบัน)
export async function sendDueReminders(
  forTime?: string
): Promise<{ sent: number }> {
  const now = new Date();
  const hhmm =
    forTime ||
    `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;
  const dow = now.getDay();
  const { start, end } = dayRange(now);

  const [assignments, schedules] = await Promise.all([
    prisma.assignment.findMany({
      where: { scheduledDate: { gte: start, lt: end }, startTime: hhmm },
      include: { user: true, checkpoint: { include: { site: true } } },
    }),
    prisma.schedule.findMany({
      where: { active: true, daysOfWeek: { has: dow }, startTime: hhmm },
      include: { user: true, checkpoint: { include: { site: true } } },
    }),
  ]);

  type Entry = {
    name: string;
    lineUserId: string;
    seen: Set<string>;
    jobs: {
      checkpointName: string;
      siteName: string;
      dateStr: string;
      timeStr: string;
      note: string | null;
    }[];
  };
  const byUser = new Map<string, Entry>();
  for (const a of [...assignments, ...schedules]) {
    if (!a.user.lineUserId) continue;
    const e =
      byUser.get(a.userId) ??
      ({
        name: a.user.name,
        lineUserId: a.user.lineUserId,
        seen: new Set<string>(),
        jobs: [],
      } as Entry);
    if (!e.seen.has(a.checkpointId)) {
      e.seen.add(a.checkpointId);
      e.jobs.push({
        checkpointName: a.checkpoint.name,
        siteName: a.checkpoint.site.name,
        dateStr: fmtDate(now),
        timeStr: hhmm,
        note: a.note ?? null,
      });
    }
    byUser.set(a.userId, e);
  }

  let sent = 0;
  for (const [, u] of byUser) {
    const msg = buildReminderMessage({ staffName: u.name, jobs: u.jobs });
    if (await pushMessage(u.lineUserId, [msg])) sent++;
  }
  if (sent > 0) console.log(`[jobs] เตือนเริ่มงาน ${hhmm} → ${sent} คน`);
  return { sent };
}
