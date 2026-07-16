import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { sendExecutiveSummary } from "@/lib/jobs";

// ส่งสรุปรายงานผู้บริหารเข้า LINE ด้วยมือ (admin) ตามช่วงที่เลือกบนหน้ารายงาน
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const from = new Date(String(body?.from || ""));
  const to = new Date(String(body?.to || ""));
  const label = String(body?.label || "").trim() || "ตามช่วงที่เลือก";
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return NextResponse.json({ error: "ช่วงเวลาไม่ถูกต้อง" }, { status: 400 });
  }
  const result = await sendExecutiveSummary(from, to, label);
  return NextResponse.json({ ok: true, ...result });
}
