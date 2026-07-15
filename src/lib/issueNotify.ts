import { prisma } from "@/lib/db";
import { fmtDateTime } from "@/lib/date";
import { pushMessage, buildIssueMessage } from "@/lib/lineMessaging";
import type { IssueType } from "@prisma/client";

// แจ้งเตือน LINE ให้ "ฝ่ายที่รับผิดชอบ" (สมาชิกฝ่ายของจุด) — ถ้าไม่มีสมาชิก fallback เป็นแอดมิน/ผู้ตรวจ
export async function notifyNewIssue(opts: {
  type: IssueType;
  checkpointName: string;
  siteName: string;
  reporterName: string;
  detail: string;
  departmentId: string | null;
}) {
  try {
    let recipients = opts.departmentId
      ? await prisma.user.findMany({
          where: {
            departmentId: opts.departmentId,
            active: true,
            lineUserId: { not: null },
          },
          select: { lineUserId: true },
        })
      : [];
    if (recipients.length === 0) {
      recipients = await prisma.user.findMany({
        where: {
          role: { in: ["ADMIN", "INSPECTOR"] },
          active: true,
          lineUserId: { not: null },
        },
        select: { lineUserId: true },
      });
    }
    if (recipients.length === 0) return;

    const msg = buildIssueMessage({
      type: opts.type,
      checkpointName: opts.checkpointName,
      siteName: opts.siteName,
      reporterName: opts.reporterName,
      detail: opts.detail,
      dateStr: fmtDateTime(new Date()),
    });

    for (const r of recipients) {
      if (r.lineUserId) await pushMessage(r.lineUserId, [msg]);
    }
  } catch (e) {
    console.error("[line] notifyNewIssue:", e);
  }
}
