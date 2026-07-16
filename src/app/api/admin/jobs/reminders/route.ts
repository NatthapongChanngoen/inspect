import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { sendDueReminders } from "@/lib/jobs";

// ทดสอบเตือนเริ่มงานด้วยมือ (admin) — ไม่ต้องรอถึงเวลา
// body (optional): { "time": "HH:mm" } เพื่อจำลองเวลาที่ต้องการ
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const time =
    typeof body?.time === "string" && /^\d{2}:\d{2}$/.test(body.time)
      ? body.time
      : undefined;

  const result = await sendDueReminders(time);
  return NextResponse.json({ ok: true, ...result });
}
