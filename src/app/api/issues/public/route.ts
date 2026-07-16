import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { saveUpload } from "@/lib/storage";
import { verifyLineIdToken } from "@/lib/line";
import { notifyNewIssue } from "@/lib/issueNotify";
import type { IssueType } from "@prisma/client";

// แจ้งปัญหาสาธารณะผ่าน LINE — ใครก็ได้ที่เปิดผ่าน LINE (ผูกบัญชีหรือไม่ก็ได้)
// ยืนยันตัวด้วย LINE idToken เท่านั้น (กันสแปม — ต้องเป็นผู้ใช้ LINE จริง)
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const idToken = String(form.get("idToken") || "");
  const type = String(form.get("type") || "");
  const checkpointId = String(form.get("checkpointId") || "");
  const detail = String(form.get("detail") || "").trim();
  const photo = form.get("photo");

  // ต้องมี LINE idToken ที่ยืนยันได้
  const profile = await verifyLineIdToken(idToken);
  if (!profile) {
    return NextResponse.json(
      { error: "ยืนยันตัวตนผ่าน LINE ไม่สำเร็จ" },
      { status: 401 }
    );
  }

  if (type !== "REPAIR" && type !== "SUPPLY") {
    return NextResponse.json({ error: "ประเภทไม่ถูกต้อง" }, { status: 400 });
  }
  if (!checkpointId || !detail) {
    return NextResponse.json(
      { error: "กรุณาเลือกจุดและกรอกรายละเอียด" },
      { status: 400 }
    );
  }

  const checkpoint = await prisma.checkpoint.findUnique({
    where: { id: checkpointId },
    include: { site: true },
  });
  if (!checkpoint) {
    return NextResponse.json({ error: "ไม่พบจุดนี้" }, { status: 404 });
  }

  const hasPhoto = photo instanceof File && photo.size > 0;
  if (type === "REPAIR" && !hasPhoto) {
    return NextResponse.json(
      { error: "กรุณาถ่ายรูปปัญหา (รูปก่อนซ่อม)" },
      { status: 400 }
    );
  }
  const photoPath = hasPhoto ? await saveUpload(photo as File, "issues") : null;

  // ผูกกับบัญชีในระบบถ้าเคยผูก LINE ไว้ ไม่งั้นเก็บชื่อจาก LINE profile
  const linked = await prisma.user.findUnique({
    where: { lineUserId: profile.lineUserId },
    select: { id: true, name: true },
  });
  const reporterName = linked?.name ?? profile.name ?? "ผู้แจ้งภายนอก";

  await prisma.issue.create({
    data: {
      type: type as IssueType,
      checkpointId,
      reportedById: linked?.id ?? null,
      reporterName: linked ? null : reporterName,
      reporterLineId: linked ? null : profile.lineUserId,
      detail,
      photoPath,
    },
  });

  await notifyNewIssue({
    type: type as IssueType,
    checkpointName: checkpoint.name,
    siteName: checkpoint.site.name,
    reporterName,
    detail,
    departmentId: checkpoint.departmentId,
  });

  return NextResponse.json({ ok: true });
}
