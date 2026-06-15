import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { sendInspectorDailyList } from "@/lib/jobs";

// ทดสอบส่งรายการตรวจให้ผู้ตรวจด้วยมือ (admin) — ไม่ต้องรอ 16:30
export async function POST() {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }
  const result = await sendInspectorDailyList();
  return NextResponse.json({ ok: true, ...result });
}
