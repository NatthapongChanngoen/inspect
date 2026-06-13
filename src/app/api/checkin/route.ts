import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { saveUpload } from "@/lib/storage";
import {
  consumeSession,
  validateProximity,
  validateGpsFreshness,
  assessSuspicion,
} from "@/lib/verify";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const form = await req.formData();
  const checkpointId = String(form.get("checkpointId") || "");
  const nonce = String(form.get("nonce") || "");
  const token = String(form.get("token") || "");
  const lat = parseFloat(String(form.get("lat")));
  const lng = parseFloat(String(form.get("lng")));
  const accuracy = parseFloat(String(form.get("accuracy") || "0"));
  const before = form.get("before");

  // หลักฐาน GPS ดิบ (อาจไม่มีบางค่าถ้าอุปกรณ์ไม่ส่ง)
  const num = (k: string): number | null => {
    const v = form.get(k);
    if (v == null || v === "") return null;
    const n = parseFloat(String(v));
    return Number.isFinite(n) ? n : null;
  };
  const gpsTimestamp = num("gpsTimestamp");
  const altitude = num("altitude");
  const speed = num("speed");
  const heading = num("heading");

  // บริบท request ไว้ตรวจย้อนหลัง
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const userAgent = req.headers.get("user-agent");

  if (!checkpointId || !token) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: "ไม่พบพิกัด GPS" }, { status: 400 });
  }
  if (!(before instanceof File)) {
    return NextResponse.json({ error: "กรุณาแนบรูปก่อนทำงาน" }, { status: 400 });
  }

  const checkpoint = await prisma.checkpoint.findUnique({
    where: { id: checkpointId },
  });
  if (!checkpoint || !checkpoint.active) {
    return NextResponse.json({ error: "ไม่พบจุดทำงานนี้" }, { status: 404 });
  }

  // 1) ตรวจรหัสเซสชัน (กัน replay) — ใช้ครั้งเดียว
  const session = await consumeSession(nonce, user.id, checkpointId, "CHECKIN");
  if (!session.ok) {
    return NextResponse.json({ error: session.reason }, { status: 400 });
  }

  // 2) ตรวจ QR ว่าตรงจุด
  if (token !== checkpoint.qrToken) {
    return NextResponse.json(
      { error: "QR Code ไม่ตรงกับจุดทำงานนี้" },
      { status: 400 }
    );
  }

  // 3) ตรวจ GPS อยู่ในรัศมี + ความแม่นยำพอ
  const prox = validateProximity(checkpoint, lat, lng, accuracy);
  if (!prox.ok) {
    return NextResponse.json({ error: prox.reason }, { status: 400 });
  }

  // 3.1) ตรวจว่าพิกัดสดพอ (กันการส่งพิกัดแคชเก่า)
  const fresh = validateGpsFreshness(gpsTimestamp ?? NaN);
  if (!fresh.ok) {
    return NextResponse.json({ error: fresh.reason }, { status: 400 });
  }

  // 3.2) ประเมินสัญญาณน่าสงสัย (fake GPS) — ไม่บล็อก แค่ตั้งธงให้ผู้ตรวจดู
  const suspiciousFlags = assessSuspicion({
    accuracy,
    altitude,
    speed,
    heading,
    gpsTimestamp,
  });

  // 4) กันเช็คอินซ้ำในวันเดียวกัน (ยอมให้ทำใหม่เฉพาะถ้าของเดิมถูกตีกลับ REJECTED)
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const existing = await prisma.workRecord.findFirst({
    where: {
      userId: user.id,
      checkpointId,
      checkInAt: { gte: start, lt: end },
      status: { in: ["IN_PROGRESS", "SUBMITTED", "APPROVED"] },
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "คุณเช็คอินจุดนี้ไปแล้ววันนี้", id: existing.id },
      { status: 409 }
    );
  }

  // หา assignment ของวันนี้ (ถ้ามี) เพื่อเชื่อมโยง
  const assignment = await prisma.assignment.findFirst({
    where: {
      userId: user.id,
      checkpointId,
      scheduledDate: { gte: start, lt: end },
    },
  });

  const beforePath = await saveUpload(before, "before");

  const record = await prisma.workRecord.create({
    data: {
      checkpointId,
      userId: user.id,
      assignmentId: assignment?.id,
      status: "IN_PROGRESS",
      checkInLat: lat,
      checkInLng: lng,
      checkInAccuracy: Number.isFinite(accuracy) ? accuracy : null,
      distanceMeters: prox.distance,
      gpsTimestamp: gpsTimestamp ? new Date(gpsTimestamp) : null,
      gpsAltitude: altitude,
      gpsSpeed: speed,
      gpsHeading: heading,
      ipAddress,
      userAgent,
      suspicious: suspiciousFlags.length > 0,
      suspiciousFlags,
      verifiedByQr: true,
      verifiedByGps: true,
      beforePhotoPath: beforePath,
    },
  });

  return NextResponse.json({ id: record.id });
}
