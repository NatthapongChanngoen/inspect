import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { saveUpload } from "@/lib/storage";
import { notifyNewIssue } from "@/lib/issueNotify";
import type { IssueType } from "@prisma/client";

// แจ้งปัญหา (ซ่อมอุปกรณ์ชำรุด / ของหมด) — ผู้ล็อกอินคนใดก็แจ้งได้
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const form = await req.formData();
  const type = String(form.get("type") || "");
  const checkpointId = String(form.get("checkpointId") || "");
  const detail = String(form.get("detail") || "").trim();
  const photo = form.get("photo");

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
  // งานซ่อมต้องแนบรูปเสมอ (ใช้เป็น "รูปก่อนซ่อม")
  if (type === "REPAIR" && !hasPhoto) {
    return NextResponse.json(
      { error: "กรุณาถ่ายรูปปัญหา (รูปก่อนซ่อม)" },
      { status: 400 }
    );
  }
  const photoPath = hasPhoto ? await saveUpload(photo as File, "issues") : null;

  await prisma.issue.create({
    data: {
      type: type as IssueType,
      checkpointId,
      reportedById: user.id,
      detail,
      photoPath,
    },
  });

  await notifyNewIssue({
    type: type as IssueType,
    checkpointName: checkpoint.name,
    siteName: checkpoint.site.name,
    reporterName: user.name ?? "พนักงาน",
    detail,
    departmentId: checkpoint.departmentId,
  });

  return NextResponse.json({ ok: true });
}
