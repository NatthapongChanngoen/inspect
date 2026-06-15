import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { runMidnightCutoff } from "@/lib/jobs";

// ทดสอบตัดรอบด้วยมือ (admin) — ไม่ต้องรอเที่ยงคืน
// body (optional): { "date": "YYYY-MM-DD" } เพื่อระบุวันที่ต้องการตัดรอบ
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const dateStr = String(body?.date || "");
  const forDate = dateStr ? new Date(dateStr + "T00:00:00") : undefined;

  const result = await runMidnightCutoff(
    forDate && !Number.isNaN(forDate.getTime()) ? forDate : undefined
  );
  return NextResponse.json({ ok: true, ...result });
}
