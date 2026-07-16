import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { verifyLineIdToken } from "@/lib/line";

// ผูกบัญชี LINE เข้ากับผู้ใช้ที่ล็อกอินด้วย "ชื่อ + รหัสผ่าน" (ผู้ตรวจ/ผู้บริหาร/แอดมิน)
// ยืนยันตัวตนด้วยรหัสผ่าน (bcrypt) แล้วผูก lineUserId — คู่ขนานกับ /api/line/bind (แม่บ้าน/รปภ ใช้เลขบัตร)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const idToken = String(body?.idToken || "");
  const username = String(body?.username || "").trim();
  const password = String(body?.password || "");

  if (!idToken || !username || !password) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }

  // ตรวจชื่อ+รหัสผ่าน (เหมือน provider credentials)
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.active) {
    return NextResponse.json(
      { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" },
      { status: 401 }
    );
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json(
      { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" },
      { status: 401 }
    );
  }

  // ยืนยันบัญชี LINE
  const profile = await verifyLineIdToken(idToken);
  if (!profile) {
    return NextResponse.json(
      { error: "ยืนยันบัญชี LINE ไม่สำเร็จ" },
      { status: 400 }
    );
  }

  // กันผูกบัญชี LINE เดียวกับผู้ใช้คนอื่น
  const taken = await prisma.user.findUnique({
    where: { lineUserId: profile.lineUserId },
  });
  if (taken && taken.id !== user.id) {
    return NextResponse.json(
      { error: "บัญชี LINE นี้ถูกผูกกับผู้ใช้อื่นแล้ว" },
      { status: 409 }
    );
  }

  // ผูก lineUserId (ถ้ายังไม่ผูก) — ถ้าผูกไว้แล้วกับตัวเองก็ไม่เป็นไร
  if (user.lineUserId !== profile.lineUserId) {
    await prisma.user.update({
      where: { id: user.id },
      data: { lineUserId: profile.lineUserId },
    });
  }

  return NextResponse.json({ ok: true });
}
