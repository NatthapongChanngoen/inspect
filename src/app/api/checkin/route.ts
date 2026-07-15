import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { saveUpload } from "@/lib/storage";
import { consumeSession } from "@/lib/verify";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const form = await req.formData();
  const checkpointId = String(form.get("checkpointId") || "");
  const nonce = String(form.get("nonce") || "");
  const token = String(form.get("token") || "");
  const verifyPhoto = form.get("verifyPhoto");
  const before = form.get("before");

  // บริบท request ไว้ตรวจย้อนหลัง
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const userAgent = req.headers.get("user-agent");

  if (!checkpointId || !token) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }
  if (!(verifyPhoto instanceof File)) {
    return NextResponse.json(
      { error: "กรุณาถ่ายรูปยืนยันที่จุด" },
      { status: 400 }
    );
  }
  if (!(before instanceof File)) {
    return NextResponse.json(
      { error: "กรุณาถ่ายรูปก่อนเริ่มงาน" },
      { status: 400 }
    );
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

  // 3) กันเช็คอินซ้ำในวันเดียวกัน (ยอมให้ทำใหม่เฉพาะถ้าของเดิมถูกตีกลับ REJECTED)
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

  // ผู้ตรวจ (สูงสุด 2 คน) + เวลาเริ่ม + วิธีตรวจ (จาก assignment วันนี้ หรือ งานประจำที่ตรงวัน)
  let inspectorId: string | null = assignment?.inspectorId ?? null;
  let inspectorId2: string | null = assignment?.inspectorId2 ?? null;
  let expectedStartTime: string | null = assignment?.startTime ?? null;
  let reviewPolicy: "REMOTE" | "ON_SITE" | "BOTH" =
    assignment?.reviewPolicy ?? "BOTH";
  if (!inspectorId || !expectedStartTime || !assignment) {
    const sched = await prisma.schedule.findFirst({
      where: {
        userId: user.id,
        checkpointId,
        active: true,
        daysOfWeek: { has: new Date().getDay() },
      },
      select: {
        inspectorId: true,
        inspectorId2: true,
        startTime: true,
        reviewPolicy: true,
      },
    });
    // ถ้าไม่มีผู้ตรวจจาก assignment ให้ยกทั้งคู่จากงานประจำ (กันการปนแหล่ง)
    if (!inspectorId) {
      inspectorId = sched?.inspectorId ?? null;
      inspectorId2 = sched?.inspectorId2 ?? null;
    }
    if (!expectedStartTime) expectedStartTime = sched?.startTime ?? null;
    if (!assignment && sched?.reviewPolicy) reviewPolicy = sched.reviewPolicy;
  }

  // นับสาย: ใช้ฐานเวลา = เวลาเริ่มที่กำหนด หรือ เวลาที่งานก่อนหน้า "เสร็จ" (อันไหนช้ากว่า)
  // → ทำหลายจุดต่อเนื่องจะไม่ถูกนับสายจากเวลาเริ่มของจุดแรก (คนเดียวทำหลายจุดพร้อมกันไม่ได้)
  // null = ไม่ได้กำหนดเวลาเริ่ม → วัดสายไม่ได้
  let lateMinutes: number | null = null;
  let lateBaseAt: Date | null = null;
  if (expectedStartTime && /^([01]?\d|2[0-3]):[0-5]\d$/.test(expectedStartTime)) {
    const [hh, mm] = expectedStartTime.split(":").map(Number);
    const exp = new Date(start);
    exp.setHours(hh, mm, 0, 0);

    // งานก่อนหน้าของคนนี้ที่ "ส่งงานแล้ว" ในวันเดียวกัน (ยังไม่ส่ง = ยังไม่นับว่าเสร็จ)
    const prevDone = await prisma.workRecord.findFirst({
      where: {
        userId: user.id,
        checkInAt: { gte: start, lt: end },
        submittedAt: { not: null },
      },
      orderBy: { submittedAt: "desc" },
      select: { submittedAt: true },
    });

    const prev = prevDone?.submittedAt ?? null;
    lateBaseAt = prev && prev.getTime() > exp.getTime() ? prev : exp;
    lateMinutes = Math.max(
      0,
      Math.round((Date.now() - lateBaseAt.getTime()) / 60000)
    );
  }

  const checkinPath = await saveUpload(verifyPhoto, "checkin");
  const beforePath = await saveUpload(before, "before");

  const record = await prisma.workRecord.create({
    data: {
      checkpointId,
      userId: user.id,
      assignmentId: assignment?.id,
      inspectorId,
      inspectorId2,
      expectedStartTime,
      lateMinutes,
      lateBaseAt,
      reviewPolicy,
      status: "IN_PROGRESS",
      ipAddress,
      userAgent,
      verifiedByQr: true,
      checkinPhotoPath: checkinPath,
      beforePhotoPath: beforePath,
    },
  });

  return NextResponse.json({ id: record.id });
}
