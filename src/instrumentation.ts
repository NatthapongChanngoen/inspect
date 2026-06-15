// เริ่มตัวตั้งเวลาตอนเซิร์ฟเวอร์บูต — รันเฉพาะ Node runtime
// (Next.js เรียก register() ครั้งเดียวตอน start)
// ใช้ setTimeout เอง (ไม่พึ่ง dependency) — คอนเทนเนอร์ตั้ง TZ=Asia/Bangkok แล้ว
// ดังนั้น new Date()/setHours จึงเป็นเวลาไทย
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const g = globalThis as typeof globalThis & { __cronStarted?: boolean };
  if (g.__cronStarted) return;
  g.__cronStarted = true;

  const { runMidnightCutoff, sendInspectorDailyList } = await import(
    "@/lib/jobs"
  );

  function msUntil(hour: number, minute: number): number {
    const now = new Date();
    const next = new Date(now);
    next.setHours(hour, minute, 0, 0);
    if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
    return next.getTime() - now.getTime();
  }

  function scheduleDaily(
    hour: number,
    minute: number,
    fn: () => Promise<unknown>
  ) {
    setTimeout(
      async () => {
        try {
          await fn();
        } catch (e) {
          console.error("[cron] job error:", e);
        }
        scheduleDaily(hour, minute, fn); // ตั้งรอบถัดไป (พรุ่งนี้)
      },
      msUntil(hour, minute)
    );
  }

  // 00:00 ทุกวัน — ตัดรอบ: งานเมื่อวานที่ยังไม่ส่ง → "ไม่ได้ปฏิบัติงาน"
  scheduleDaily(0, 0, () => runMidnightCutoff());
  // 16:30 ทุกวัน — ส่งรายการที่ต้องตรวจให้ผู้ตรวจผ่าน LINE
  scheduleDaily(16, 30, () => sendInspectorDailyList());

  console.log(
    "[cron] เริ่มงานตามเวลาแล้ว: ตัดรอบ 00:00 + รายการตรวจ 16:30 (Asia/Bangkok)"
  );
}
