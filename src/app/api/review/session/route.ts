import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { createSession } from "@/lib/verify";

// ออกรหัสเซสชันสำหรับผู้ตรวจที่จะไปตรวจ "ที่จุดจริง"
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user || (user.role !== "INSPECTOR" && user.role !== "ADMIN")) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const workRecordId = String(body?.workRecordId || "");
  if (!workRecordId) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }

  const record = await prisma.workRecord.findUnique({
    where: { id: workRecordId },
    select: { checkpointId: true, status: true },
  });
  if (!record) {
    return NextResponse.json({ error: "ไม่พบงานนี้" }, { status: 404 });
  }

  const nonce = await createSession(user.id, record.checkpointId, "REVIEW");
  return NextResponse.json({ nonce });
}
