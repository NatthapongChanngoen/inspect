import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { saveUpload } from "@/lib/storage";
import { consumeSession, validateProximity } from "@/lib/verify";

// อนุมัติแบบ "ไปตรวจที่จุดจริง" — ต้องสแกน QR + GPS ในรัศมี + ถ่ายรูป
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user || (user.role !== "INSPECTOR" && user.role !== "ADMIN")) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }

  const form = await req.formData();
  const workRecordId = String(form.get("workRecordId") || "");
  const nonce = String(form.get("nonce") || "");
  const token = String(form.get("token") || "");
  const result = String(form.get("result") || "");
  const comment = String(form.get("comment") || "").trim();
  const lat = parseFloat(String(form.get("lat")));
  const lng = parseFloat(String(form.get("lng")));
  const accuracy = parseFloat(String(form.get("accuracy") || "0"));
  const photo = form.get("photo");

  if (!workRecordId || !token || (result !== "PASS" && result !== "FAIL")) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: "ไม่พบพิกัด GPS" }, { status: 400 });
  }
  if (!(photo instanceof File)) {
    return NextResponse.json({ error: "กรุณาแนบรูปจากจุดตรวจ" }, { status: 400 });
  }

  const record = await prisma.workRecord.findUnique({
    where: { id: workRecordId },
    include: { checkpoint: true },
  });
  if (!record) {
    return NextResponse.json({ error: "ไม่พบงานนี้" }, { status: 404 });
  }
  if (record.status !== "SUBMITTED") {
    return NextResponse.json({ error: "งานนี้ตรวจแล้ว" }, { status: 400 });
  }

  // 1) ตรวจรหัสเซสชัน (กัน replay)
  const session = await consumeSession(
    nonce,
    user.id,
    record.checkpointId,
    "REVIEW"
  );
  if (!session.ok) {
    return NextResponse.json({ error: session.reason }, { status: 400 });
  }

  // 2) ตรวจ QR ว่าตรงจุด
  if (token !== record.checkpoint.qrToken) {
    return NextResponse.json(
      { error: "QR Code ไม่ตรงกับจุดงานนี้" },
      { status: 400 }
    );
  }

  // 3) ตรวจ GPS อยู่ในรัศมี + ความแม่นยำพอ
  const prox = validateProximity(record.checkpoint, lat, lng, accuracy);
  if (!prox.ok) {
    return NextResponse.json({ error: prox.reason }, { status: 400 });
  }

  const photoPath = await saveUpload(photo, "review");

  await prisma.$transaction([
    prisma.review.upsert({
      where: { workRecordId },
      update: {
        inspectorId: user.id,
        result,
        comment: comment || null,
        mode: "ON_SITE",
        inspectorLat: lat,
        inspectorLng: lng,
        inspectorDistanceMeters: prox.distance,
        inspectorPhotoPath: photoPath,
        reviewedAt: new Date(),
      },
      create: {
        workRecordId,
        inspectorId: user.id,
        result,
        comment: comment || null,
        mode: "ON_SITE",
        inspectorLat: lat,
        inspectorLng: lng,
        inspectorDistanceMeters: prox.distance,
        inspectorPhotoPath: photoPath,
      },
    }),
    prisma.workRecord.update({
      where: { id: workRecordId },
      data: { status: result === "PASS" ? "APPROVED" : "REJECTED" },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
