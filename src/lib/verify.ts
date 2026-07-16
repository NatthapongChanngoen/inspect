import { prisma } from "@/lib/db";

const SESSION_TTL_MIN = Number(process.env.CHECKIN_SESSION_TTL_MIN || "5");

export type SessionPurpose = "CHECKIN" | "REVIEW";

// สร้างเซสชันใช้ครั้งเดียว อายุสั้น แล้วคืน nonce (พร้อมลบเซสชันที่หมดอายุทิ้ง)
export async function createSession(
  userId: string,
  checkpointId: string,
  purpose: SessionPurpose
): Promise<string> {
  // ลบเซสชันหมดอายุ (housekeeping เบาๆ)
  await prisma.checkInSession
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => {});

  const expiresAt = new Date(Date.now() + SESSION_TTL_MIN * 60 * 1000);
  const session = await prisma.checkInSession.create({
    data: { userId, checkpointId, purpose, expiresAt },
  });
  return session.nonce;
}

// ตรวจและ "ใช้" เซสชัน (single-use) — คืน ok=false พร้อมเหตุผลถ้าไม่ผ่าน
export async function consumeSession(
  nonce: string,
  userId: string,
  checkpointId: string,
  purpose: SessionPurpose
): Promise<{ ok: boolean; reason?: string }> {
  if (!nonce) return { ok: false, reason: "ไม่พบรหัสเซสชัน กรุณาเริ่มใหม่" };

  const session = await prisma.checkInSession.findUnique({ where: { nonce } });
  if (
    !session ||
    session.userId !== userId ||
    session.checkpointId !== checkpointId ||
    session.purpose !== purpose
  ) {
    return { ok: false, reason: "รหัสเซสชันไม่ถูกต้อง กรุณาเริ่มใหม่" };
  }
  if (session.usedAt) {
    return { ok: false, reason: "รหัสเซสชันถูกใช้ไปแล้ว กรุณาเริ่มใหม่" };
  }
  if (session.expiresAt < new Date()) {
    return { ok: false, reason: "เซสชันหมดอายุ กรุณาเริ่มใหม่" };
  }

  await prisma.checkInSession.update({
    where: { nonce },
    data: { usedAt: new Date() },
  });
  return { ok: true };
}
