// งานตามเวลา (cron): ตัดรอบเที่ยงคืน + ส่งรายการตรวจให้ผู้ตรวจตอน 16:30
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/date";
import {
  pushMessage,
  buildInspectorListMessage,
} from "@/lib/lineMessaging";

function dayRange(d: Date) {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

// สถานะที่ถือว่า "ปฏิบัติงานแล้ว" (มีการส่งงาน) — ไม่นับว่าขาด
const PERFORMED: ("SUBMITTED" | "APPROVED" | "REJECTED")[] = [
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
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

// ส่งรายการที่ต้องตรวจวันนี้ (งานสถานะ SUBMITTED) ให้ผู้ตรวจทุกคนที่ผูก LINE
export async function sendInspectorDailyList(): Promise<{ sent: number }> {
  const { start, end } = dayRange(new Date());

  const pending = await prisma.workRecord.findMany({
    where: { status: "SUBMITTED", submittedAt: { gte: start, lt: end } },
    include: { user: true, checkpoint: { include: { site: true } } },
    orderBy: { submittedAt: "asc" },
  });

  const items = pending.map((r) => ({
    siteName: r.checkpoint.site.name,
    checkpointName: r.checkpoint.name,
    staffName: r.user.name,
  }));

  const inspectors = await prisma.user.findMany({
    where: {
      role: "INSPECTOR",
      active: true,
      lineUserId: { not: null },
    },
    select: { lineUserId: true },
  });

  const msg = buildInspectorListMessage({ dateStr: fmtDate(start), items });

  let sent = 0;
  for (const ins of inspectors) {
    if (ins.lineUserId && (await pushMessage(ins.lineUserId, [msg]))) sent++;
  }
  console.log(
    `[jobs] ส่งรายการตรวจ (${items.length} จุด) ให้ผู้ตรวจ ${sent} คน`
  );
  return { sent };
}
