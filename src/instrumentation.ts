// เริ่มตัวตั้งเวลาตอนเซิร์ฟเวอร์บูต — รันเฉพาะ Node runtime
// (Next.js เรียก register() ครั้งเดียวตอน start)
// ใช้ setTimeout เอง (ไม่พึ่ง dependency) — คอนเทนเนอร์ตั้ง TZ=Asia/Bangkok แล้ว
// ดังนั้น new Date()/setHours จึงเป็นเวลาไทย
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const g = globalThis as typeof globalThis & { __cronStarted?: boolean };
  if (g.__cronStarted) return;
  g.__cronStarted = true;

  const {
    runMidnightCutoff,
    runReviewCutoff,
    sendInspectorDailyList,
    sendDueReminders,
    sendExecutiveSummary,
    previousMonthRange,
  } = await import("@/lib/jobs");

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

  // ทุก 1 นาที (ตรงต้นนาที) — เตือนพนักงานเมื่อถึงเวลาเริ่มงานที่กำหนด
  function scheduleEveryMinute(fn: () => Promise<unknown>) {
    const now = new Date();
    const delay = Math.max(
      0,
      (60 - now.getSeconds()) * 1000 - now.getMilliseconds()
    );
    setTimeout(() => {
      const run = () =>
        fn().catch((e) => console.error("[cron] reminder:", e));
      run();
      setInterval(run, 60000);
    }, delay);
  }

  // 00:00 ทุกวัน — ตัดรอบ: งานเมื่อวานที่ยังไม่ส่ง → "ไม่ได้ปฏิบัติงาน"
  scheduleDaily(0, 0, () => runMidnightCutoff());
  // 16:30 ทุกวัน — ส่งรายการที่ต้องตรวจให้ผู้ตรวจผ่าน LINE
  scheduleDaily(16, 30, () => sendInspectorDailyList());
  // 17:00 ทุกวัน — ตัดรอบงานรอตรวจ: ยังรอตรวจ → "ไม่ได้รับการตรวจ"
  scheduleDaily(17, 0, () => runReviewCutoff());
  // 08:00 ทุกวัน — ถ้าเป็นวันที่ 1 ส่งสรุปรายงานผู้บริหาร (เดือนก่อน) เข้า LINE
  scheduleDaily(8, 0, async () => {
    if (new Date().getDate() !== 1) return;
    const { from, to, label } = previousMonthRange();
    await sendExecutiveSummary(from, to, label);
  });
  // ทุกนาที — เตือนถึงเวลาเริ่มงาน
  scheduleEveryMinute(() => sendDueReminders());

  console.log(
    "[cron] เริ่มงานตามเวลาแล้ว: ตัดรอบ 00:00 + รายการตรวจ 16:30 + ตัดรอบรอตรวจ 17:00 + รายงานผู้บริหารต้นเดือน 08:00 + เตือนเริ่มงานทุกนาที (Asia/Bangkok)"
  );
}
