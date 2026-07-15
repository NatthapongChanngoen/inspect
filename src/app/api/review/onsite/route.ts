import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { saveUpload } from "@/lib/storage";
import { consumeSession } from "@/lib/verify";
import { maybeNotifyReviewSummary, notifyRejected } from "@/lib/reviewNotify";

// อนุมัติแบบ "ไปตรวจที่จุดจริง" — สแกน QR ที่จุด + ถ่ายรูปยืนยัน
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
  const photo = form.get("photo");

  if (!workRecordId || !token || (result !== "PASS" && result !== "FAIL")) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
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
  if (record.status !== "SUBMITTED" && record.status !== "NOT_REVIEWED") {
    return NextResponse.json({ error: "งานนี้ตรวจแล้ว" }, { status: 400 });
  }
  // ผู้ตรวจทุกคนตรวจงานไหนก็ได้ (ไม่มีการระบุผู้ตรวจล่วงหน้าแล้ว)
  // งานนี้กำหนดให้ตรวจระยะไกลเท่านั้น → ห้ามตรวจที่จุด
  if (record.reviewPolicy === "REMOTE") {
    return NextResponse.json(
      { error: "งานนี้กำหนดให้ตรวจระยะไกลเท่านั้น" },
      { status: 400 }
    );
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

  const photoPath = await saveUpload(photo, "review");

  await prisma.$transaction([
    prisma.review.upsert({
      where: { workRecordId },
      update: {
        inspectorId: user.id,
        result,
        comment: comment || null,
        mode: "ON_SITE",
        inspectorPhotoPath: photoPath,
        reviewedAt: new Date(),
      },
      create: {
        workRecordId,
        inspectorId: user.id,
        result,
        comment: comment || null,
        mode: "ON_SITE",
        inspectorPhotoPath: photoPath,
      },
    }),
    prisma.workRecord.update({
      where: { id: workRecordId },
      data: { status: result === "PASS" ? "APPROVED" : "REJECTED" },
    }),
  ]);

  // ไม่ผ่าน → แจ้งพนักงานทันทีพร้อมรายละเอียด (และกันไม่ให้ซ้ำในสรุปรวม)
  if (result === "FAIL") await notifyRejected(workRecordId);
  await maybeNotifyReviewSummary(workRecordId);

  return NextResponse.json({ ok: true });
}
