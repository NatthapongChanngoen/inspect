import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { verifyLineIdToken } from "@/lib/line";

// ผูกบัญชี LINE เข้ากับผู้ใช้ในระบบครั้งแรก (ยืนยันด้วย username/password เดิม)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const idToken = String(body?.idToken || "");
  const username = String(body?.username || "").trim();
  const password = String(body?.password || "");

  if (!idToken || !username || !password) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }

  const profile = await verifyLineIdToken(idToken);
  if (!profile) {
    return NextResponse.json(
      { error: "ยืนยันบัญชี LINE ไม่สำเร็จ" },
      { status: 400 }
    );
  }

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

  await prisma.user.update({
    where: { id: user.id },
    data: { lineUserId: profile.lineUserId },
  });

  return NextResponse.json({ ok: true });
}
