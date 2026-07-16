import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/date";
import {
  pushMessage,
  buildReviewSummaryMessage,
  buildRejectedMessage,
} from "@/lib/lineMessaging";

// แจ้งพนักงานทันทีเมื่องาน "ไม่ผ่าน" พร้อมรายละเอียด (เรียกเฉพาะตอน result=FAIL)
// เซ็ต resultNotifiedAt ให้งานนี้ด้วย เพื่อไม่ให้ไปแจ้งซ้ำในสรุปรวมภายหลัง
export async function notifyRejected(workRecordId: string) {
  try {
    const rec = await prisma.workRecord.findUnique({
      where: { id: workRecordId },
      include: {
        user: true,
        checkpoint: { include: { site: true } },
        review: true,
      },
    });
    if (!rec || rec.status !== "REJECTED") return;

    if (rec.user.lineUserId) {
      const msg = buildRejectedMessage({
        staffName: rec.user.name,
        checkpointName: rec.checkpoint.name,
        siteName: rec.checkpoint.site.name,
        comment: rec.review?.comment ?? null,
        dateStr: fmtDate(rec.checkInAt),
      });
      await pushMessage(rec.user.lineUserId, [msg]);
    }

    await prisma.workRecord.update({
      where: { id: workRecordId },
      data: { resultNotifiedAt: new Date() },
    });
  } catch (e) {
    console.error("[line] rejected notify:", e);
  }
}

// ส่งสรุปผลตรวจเข้า LINE — เฉพาะเมื่อผู้ตรวจตรวจงานของพนักงานคนนั้น "ครบทุกงานของวัน" แล้ว
// รวมทุกงานที่ยังไม่เคยแจ้งเป็นข้อความเดียว (กันส่งซ้ำด้วย resultNotifiedAt)
export async function maybeNotifyReviewSummary(workRecordId: string) {
  try {
    const rec = await prisma.workRecord.findUnique({
      where: { id: workRecordId },
      select: { userId: true, checkInAt: true },
    });
    if (!rec) return;

    // ขอบเขต = งานของพนักงานคนนั้นในวันเดียวกัน (อิงจาก checkInAt)
    const start = new Date(rec.checkInAt);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const todays = await prisma.workRecord.findMany({
      where: { userId: rec.userId, checkInAt: { gte: start, lt: end } },
      include: {
        checkpoint: { include: { site: true } },
        review: true,
        user: true,
      },
      orderBy: { checkInAt: "asc" },
    });

    // ยังตรวจไม่ครบ (มีงานค้าง) → ยังไม่ส่ง
    const pending = todays.some(
      (r) =>
        r.status === "IN_PROGRESS" ||
        r.status === "SUBMITTED" ||
        r.status === "NOT_REVIEWED" ||
        r.status === "RETURNED"
    );
    if (pending) return;

    // เฉพาะงานที่ตรวจแล้ว + ยังไม่เคยแจ้ง
    const reviewed = todays.filter(
      (r) =>
        (r.status === "APPROVED" || r.status === "REJECTED") &&
        !r.resultNotifiedAt
    );
    if (reviewed.length === 0) return;

    const user = todays[0].user;
    if (user.lineUserId) {
      const msg = buildReviewSummaryMessage({
        staffName: user.name,
        dateStr: fmtDate(start),
        items: reviewed.map((r) => ({
          checkpointName: r.checkpoint.name,
          siteName: r.checkpoint.site.name,
          result: r.status === "APPROVED" ? "PASS" : "FAIL",
          comment: r.review?.comment ?? null,
        })),
      });
      await pushMessage(user.lineUserId, [msg]);
    }

    // เซ็ตว่าแจ้งแล้ว (กันส่งซ้ำ) — ทำแม้ไม่มี lineUserId เพื่อไม่ให้ค้างสถานะ
    await prisma.workRecord.updateMany({
      where: { id: { in: reviewed.map((r) => r.id) } },
      data: { resultNotifiedAt: new Date() },
    });
  } catch (e) {
    console.error("[line] review summary:", e);
  }
}
