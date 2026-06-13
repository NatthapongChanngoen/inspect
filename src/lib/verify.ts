import { prisma } from "@/lib/db";
import { haversineMeters } from "@/lib/geo";
import type { Checkpoint } from "@prisma/client";

const MAX_ACCURACY_M = Number(process.env.CHECKIN_MAX_ACCURACY_M || "50");
const SESSION_TTL_MIN = Number(process.env.CHECKIN_SESSION_TTL_MIN || "5");
// พิกัดต้องสดไม่เกินกี่วินาที (กันการส่งพิกัดแคชเก่า)
const MAX_GPS_AGE_SEC = Number(process.env.CHECKIN_MAX_GPS_AGE_SEC || "120");
// accuracy ที่ "ดีเกินจริง" จนน่าสงสัยว่าเป็น fake GPS (เมตร)
const SUSPICIOUS_ACCURACY_M = Number(
  process.env.CHECKIN_SUSPICIOUS_ACCURACY_M || "5"
);

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

// ตรวจระยะ GPS อยู่ในรัศมี + ความแม่นยำพอ
export function validateProximity(
  checkpoint: Pick<Checkpoint, "latitude" | "longitude" | "radiusMeters">,
  lat: number,
  lng: number,
  accuracy: number
): { ok: boolean; distance: number; reason?: string } {
  const distance = haversineMeters(
    lat,
    lng,
    checkpoint.latitude,
    checkpoint.longitude
  );

  if (Number.isFinite(accuracy) && accuracy > 0 && accuracy > MAX_ACCURACY_M) {
    return {
      ok: false,
      distance,
      reason: `สัญญาณ GPS ไม่แม่นยำพอ (±${Math.round(
        accuracy
      )} ม. เกิน ${MAX_ACCURACY_M} ม.) กรุณาลองใหม่กลางที่โล่ง`,
    };
  }

  if (distance > checkpoint.radiusMeters) {
    return {
      ok: false,
      distance,
      reason: `คุณอยู่ห่างจากจุด ${Math.round(
        distance
      )} เมตร (อนุญาตไม่เกิน ${checkpoint.radiusMeters} เมตร)`,
    };
  }

  return { ok: true, distance };
}

// ตรวจว่าพิกัดสดพอ (กันการส่งพิกัดแคชเก่า) — บล็อกถ้าเก่าเกินไป
export function validateGpsFreshness(
  gpsTimestamp: number,
  now: number = Date.now()
): { ok: boolean; ageSec: number; reason?: string } {
  if (!Number.isFinite(gpsTimestamp) || gpsTimestamp <= 0) {
    // ไม่มี timestamp — ไม่บล็อก แต่จะถูกตั้งธงน่าสงสัยแทน
    return { ok: true, ageSec: -1 };
  }
  const ageSec = (now - gpsTimestamp) / 1000;
  if (ageSec > MAX_GPS_AGE_SEC) {
    return {
      ok: false,
      ageSec,
      reason: `พิกัด GPS เก่าเกินไป (${Math.round(
        ageSec
      )} วิ) กรุณากด "อ่านพิกัด GPS" ใหม่`,
    };
  }
  // เผื่อเครื่องตั้งเวลาเพี้ยน (timestamp อยู่ในอนาคต)
  if (ageSec < -60) {
    return {
      ok: false,
      ageSec,
      reason: "เวลาในอุปกรณ์ไม่ถูกต้อง กรุณาตั้งเวลาเป็นอัตโนมัติแล้วลองใหม่",
    };
  }
  return { ok: true, ageSec };
}

// ข้อมูลดิบจากอุปกรณ์ ไว้ประเมินความน่าสงสัย
export type GpsSignals = {
  accuracy: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  gpsTimestamp: number | null;
};

// ประเมินสัญญาณน่าสงสัยว่าเป็น fake GPS — ไม่บล็อก แค่ตั้งธงให้ผู้ตรวจดู
export function assessSuspicion(s: GpsSignals): string[] {
  const flags: string[] = [];

  // ไม่มี timestamp ของพิกัดเลย (มักเกิดจากการยิง API ตรง/ปลอมพิกัด)
  if (!s.gpsTimestamp || !Number.isFinite(s.gpsTimestamp)) {
    flags.push("ไม่มีเวลาพิกัดจากอุปกรณ์");
  }

  // accuracy ดีเกินจริง — GPS จริงบนมือถือมักไม่ต่ำกว่า ~5 ม.
  if (
    Number.isFinite(s.accuracy) &&
    s.accuracy > 0 &&
    s.accuracy < SUSPICIOUS_ACCURACY_M
  ) {
    flags.push(`ความแม่นยำดีผิดปกติ (±${Math.round(s.accuracy)} ม.)`);
  }

  // fake GPS ส่วนใหญ่ไม่ให้ค่า altitude/speed/heading (เป็น null ทั้งหมด)
  if (s.altitude == null && s.speed == null && s.heading == null) {
    flags.push("ไม่มีข้อมูลความสูง/ความเร็ว/ทิศทาง");
  }

  return flags;
}
