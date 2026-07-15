import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { saveUpload } from "@/lib/storage";
import { fmtDateTime } from "@/lib/date";
import {
  pushMessage,
  buildRepairDoneMessage,
  buildSupplyRefilledMessage,
} from "@/lib/lineMessaging";

// ปิดงาน: อัปโหลดรูปหลักฐาน → สถานะ RESOLVED
// REPAIR: ต้องผ่านการอนุมัติ (APPROVED) · SUPPLY: ต้องรับเรื่องแล้ว (IN_PROGRESS)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const form = await req.formData();
  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return NextResponse.json({ error: "กรุณาแนบรูปหลักฐาน" }, { status: 400 });
  }

  const issue = await prisma.issue.findUnique({
    where: { id },
    include: {
      checkpoint: { include: { site: true } },
      reportedBy: { select: { lineUserId: true } },
    },
  });
  if (!issue) {
    return NextResponse.json({ error: "ไม่พบรายการนี้" }, { status: 404 });
  }
  // REPAIR ปิดได้เมื่อ APPROVED · SUPPLY ปิดได้เมื่อ IN_PROGRESS (รับเรื่องแล้ว)
  const isRepairApproved =
    issue.type === "REPAIR" && issue.status === "APPROVED";
  const isSupplyInProgress =
    issue.type === "SUPPLY" && issue.status === "IN_PROGRESS";
  if (!isRepairApproved && !isSupplyInProgress) {
    return NextResponse.json(
      { error: "รายการนี้ยังไม่พร้อมปิดงาน หรือปิดไปแล้ว" },
      { status: 400 }
    );
  }
  // สิทธิ์: สมาชิกฝ่ายที่รับผิดชอบ หรือ ADMIN (departmentId ไม่มีใน session → ดึงจาก DB)
  const meDb = await prisma.user.findUnique({
    where: { id: user.id },
    select: { departmentId: true },
  });
  if (
    user.role !== "ADMIN" &&
    (!meDb?.departmentId ||
      meDb.departmentId !== issue.checkpoint.departmentId)
  ) {
    return NextResponse.json(
      { error: "เฉพาะฝ่ายที่รับผิดชอบเท่านั้นที่ปิดงานได้" },
      { status: 403 }
    );
  }

  const photoPath = await saveUpload(photo, "issues");
  await prisma.issue.update({
    where: { id },
    data: {
      completionPhotoPath: photoPath,
      status: "RESOLVED",
      resolvedById: user.id,
      resolvedAt: new Date(),
    },
  });

  if (issue.type === "SUPPLY") {
    // เติมของแล้ว → แจ้งผู้แจ้ง + แอดมิน
    try {
      const admins = await prisma.user.findMany({
        where: { role: "ADMIN", active: true, lineUserId: { not: null } },
        select: { lineUserId: true },
      });
      const targets = new Set<string>();
      for (const a of admins) if (a.lineUserId) targets.add(a.lineUserId);
      // ผู้แจ้ง (บัญชีในระบบ หรือ LINE id ของผู้แจ้งภายนอก)
      if (issue.reportedBy?.lineUserId) targets.add(issue.reportedBy.lineUserId);
      else if (issue.reporterLineId) targets.add(issue.reporterLineId);

      const msg = buildSupplyRefilledMessage({
        checkpointName: issue.checkpoint.name,
        siteName: issue.checkpoint.site.name,
        detail: issue.detail,
        refilledByName: user.name ?? "ฝ่าย",
        dateStr: fmtDateTime(new Date()),
      });
      for (const t of targets) await pushMessage(t, [msg]);
    } catch (e) {
      console.error("[line] supply refilled:", e);
    }
  } else {
    // งานซ่อมเสร็จ → แจ้งผู้บริหาร (ADMIN + EXECUTIVE ที่ผูก LINE)
    try {
      const [sel, execs] = await Promise.all([
        prisma.repairProposal.findFirst({
          where: { issueId: id, selected: true },
          select: { technician: true, price: true },
        }),
        prisma.user.findMany({
          where: {
            role: { in: ["ADMIN", "EXECUTIVE"] },
            active: true,
            lineUserId: { not: null },
          },
          select: { lineUserId: true },
        }),
      ]);
      const msg = buildRepairDoneMessage({
        checkpointName: issue.checkpoint.name,
        siteName: issue.checkpoint.site.name,
        closedByName: user.name ?? "ฝ่าย",
        technician: sel?.technician ?? null,
        price: sel?.price ?? null,
        dateStr: fmtDateTime(new Date()),
      });
      for (const e of execs)
        if (e.lineUserId) await pushMessage(e.lineUserId, [msg]);
    } catch (e) {
      console.error("[line] repair done:", e);
    }
  }

  return NextResponse.json({ ok: true });
}
