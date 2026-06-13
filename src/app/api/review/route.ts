import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";

const schema = z.object({
  workRecordId: z.string().min(1),
  result: z.enum(["PASS", "FAIL"]),
  comment: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user || (user.role !== "INSPECTOR" && user.role !== "ADMIN")) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const { workRecordId, result, comment } = parsed.data;

  const record = await prisma.workRecord.findUnique({
    where: { id: workRecordId },
  });
  if (!record) {
    return NextResponse.json({ error: "ไม่พบงานนี้" }, { status: 404 });
  }
  if (record.status !== "SUBMITTED") {
    return NextResponse.json({ error: "งานนี้ตรวจแล้ว" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.review.upsert({
      where: { workRecordId },
      update: {
        inspectorId: user.id,
        result,
        comment: comment?.trim() || null,
        mode: "REMOTE",
        reviewedAt: new Date(),
      },
      create: {
        workRecordId,
        inspectorId: user.id,
        result,
        comment: comment?.trim() || null,
        mode: "REMOTE",
      },
    }),
    prisma.workRecord.update({
      where: { id: workRecordId },
      data: { status: result === "PASS" ? "APPROVED" : "REJECTED" },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
