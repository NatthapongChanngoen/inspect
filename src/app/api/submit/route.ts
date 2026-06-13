import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { saveUpload } from "@/lib/storage";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const form = await req.formData();
  const workRecordId = String(form.get("workRecordId") || "");
  const note = String(form.get("note") || "").trim();
  const after = form.get("after");

  if (!workRecordId) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }
  if (!(after instanceof File)) {
    return NextResponse.json({ error: "กรุณาแนบรูปหลังทำงาน" }, { status: 400 });
  }

  const record = await prisma.workRecord.findUnique({
    where: { id: workRecordId },
  });
  if (!record || record.userId !== user.id) {
    return NextResponse.json({ error: "ไม่พบงานนี้" }, { status: 404 });
  }
  if (record.status !== "IN_PROGRESS") {
    return NextResponse.json({ error: "งานนี้ส่งไปแล้ว" }, { status: 400 });
  }

  const afterPath = await saveUpload(after, "after");

  await prisma.workRecord.update({
    where: { id: workRecordId },
    data: {
      afterPhotoPath: afterPath,
      note: note || null,
      status: "SUBMITTED",
      submittedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
