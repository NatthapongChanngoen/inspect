import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyLineIdToken } from "@/lib/line";

// ผูกบัญชี LINE เข้ากับผู้ใช้ในระบบครั้งแรก
// ยืนยันตัวตนด้วย "ชื่อ + เลขบัตรประชาชน" (ตามที่ผู้ดูแลกรอกไว้ตอนเพิ่มผู้ใช้)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const idToken = String(body?.idToken || "");
  const name = String(body?.name || "").trim();
  const nationalId = String(body?.nationalId || "").replace(/\D/g, ""); // เอาเฉพาะตัวเลข

  if (!idToken || !name || !nationalId) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }
  if (nationalId.length !== 13) {
    return NextResponse.json(
      { error: "เลขบัตรประชาชนต้องมี 13 หลัก" },
      { status: 400 }
    );
  }

  const profile = await verifyLineIdToken(idToken);
  if (!profile) {
    return NextResponse.json(
      { error: "ยืนยันบัญชี LINE ไม่สำเร็จ" },
      { status: 400 }
    );
  }

  // หาผู้ใช้จากเลขบัตรประชาชน
  const user = await prisma.user.findUnique({ where: { nationalId } });
  if (!user || !user.active) {
    return NextResponse.json(
      { error: "ไม่พบผู้ใช้ที่ตรงกับชื่อและเลขบัตรประชาชนนี้" },
      { status: 401 }
    );
  }
  // ตรวจชื่อให้ตรง (ตัดช่องว่าง ไม่สนตัวพิมพ์)
  if (user.name.trim().toLowerCase() !== name.toLowerCase()) {
    return NextResponse.json(
      { error: "ไม่พบผู้ใช้ที่ตรงกับชื่อและเลขบัตรประชาชนนี้" },
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
