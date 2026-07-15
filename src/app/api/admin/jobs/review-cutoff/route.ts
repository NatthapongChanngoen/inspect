import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { runReviewCutoff } from "@/lib/jobs";

// ทดสอบตัดรอบงานรอตรวจด้วยมือ (admin) — ไม่ต้องรอ 17:00
// งานที่ยัง "รอตรวจ" (SUBMITTED) → "ไม่ได้รับการตรวจ" (NOT_REVIEWED)
export async function POST() {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }
  const result = await runReviewCutoff();
  return NextResponse.json({ ok: true, ...result });
}
