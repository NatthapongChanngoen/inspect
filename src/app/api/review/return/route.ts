import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { fmtDateTime } from "@/lib/date";
import { pushMessage, buildReturnedMessage } from "@/lib/lineMessaging";

const schema = z.object({
  workRecordId: z.string().min(1),
  reason: z.string().trim().min(1),
});

// ตีกลับงานให้พนักงานทำใหม่ (จุดยังไม่สะอาด) — ไม่ใช่การตัดสินผ่าน/ไม่ผ่าน
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user || (user.role !== "INSPECTOR" && user.role !== "ADMIN")) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "กรุณาระบุจุดที่ยังไม่สะอาด" },
      { status: 400 }
    );
  }
  const { workRecordId, reason } = parsed.data;

  const record = await prisma.workRecord.findUnique({
    where: { id: workRecordId },
    include: { user: true, checkpoint: { include: { site: true } } },
  });
  if (!record) {
    return NextResponse.json({ error: "ไม่พบงานนี้" }, { status: 404 });
  }
  if (record.status !== "SUBMITTED" && record.status !== "NOT_REVIEWED") {
    return NextResponse.json({ error: "งานนี้ตรวจแล้ว" }, { status: 400 });
  }

  await prisma.workRecord.update({
    where: { id: workRecordId },
    data: {
      status: "RETURNED",
      returnReason: reason,
      returnedAt: new Date(),
    },
  });

  // แจ้งพนักงานทันที (เงียบถ้าไม่มี token/ไม่ผูก LINE)
  try {
    if (record.user.lineUserId) {
      await pushMessage(record.user.lineUserId, [
        buildReturnedMessage({
          staffName: record.user.name,
          checkpointName: record.checkpoint.name,
          siteName: record.checkpoint.site.name,
          reason,
          dateStr: fmtDateTime(new Date()),
        }),
      ]);
    }
  } catch (e) {
    console.error("[line] returned:", e);
  }

  return NextResponse.json({ ok: true });
}
