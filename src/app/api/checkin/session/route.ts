import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { createSession } from "@/lib/verify";

// ออกรหัสเซสชัน (nonce) ก่อนเช็คอิน — กันการยิง request ซ้ำ
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const checkpointId = String(body?.checkpointId || "");
  if (!checkpointId) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }

  const checkpoint = await prisma.checkpoint.findUnique({
    where: { id: checkpointId },
  });
  if (!checkpoint || !checkpoint.active) {
    return NextResponse.json({ error: "ไม่พบจุดทำงานนี้" }, { status: 404 });
  }

  const nonce = await createSession(user.id, checkpointId, "CHECKIN");
  return NextResponse.json({ nonce });
}
