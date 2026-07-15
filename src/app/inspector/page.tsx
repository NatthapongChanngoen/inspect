import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { fmtDateTime } from "@/lib/date";
import StatusBadge from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function InspectorQueue() {
  const me = await currentUser();

  // รวมงานที่รอตรวจ + งานที่ตัดรอบแล้ว (ไม่ได้รับการตรวจ) → ยังตรวจย้อนหลังได้
  const where: Prisma.WorkRecordWhereInput = {
    status: { in: ["SUBMITTED", "NOT_REVIEWED"] },
  };
  // ผู้ตรวจ (ไม่ใช่แอดมิน) → เห็นเฉพาะงานที่กำหนดให้ตน (คนที่ 1 หรือ 2) + งานที่ยังไม่ระบุผู้ตรวจ
  if (me?.role === "INSPECTOR") {
    where.OR = [
      { inspectorId: me.id },
      { inspectorId2: me.id },
      // "ไม่ระบุผู้ตรวจ" = ทั้งสองช่องว่าง (ทุกคนเห็น)
      { AND: [{ inspectorId: null }, { inspectorId2: null }] },
    ];
  }

  const pending = await prisma.workRecord.findMany({
    where,
    include: {
      checkpoint: { include: { site: true, department: true } },
      user: true,
    },
    orderBy: { submittedAt: "asc" },
  });

  const reviewedCount = await prisma.review.count({
    where: {
      reviewedAt: {
        gte: (() => {
          const d = new Date();
          d.setHours(0, 0, 0, 0);
          return d;
        })(),
      },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">คิวรอตรวจ</h1>
        <span className="text-sm text-gray-500">ตรวจวันนี้แล้ว {reviewedCount} งาน</span>
      </div>

      {pending.length === 0 && (
        <div className="card p-6 text-center text-gray-500">
          ไม่มีงานรอตรวจ 🎉
        </div>
      )}

      <div className="space-y-3">
        {pending.map((r) => (
          <Link key={r.id} href={`/inspector/${r.id}`} className="card p-4 block">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{r.checkpoint.name}</div>
                <div className="text-sm text-gray-500">
                  {r.checkpoint.department
                    ? `${r.checkpoint.department.name} · `
                    : ""}
                  {r.checkpoint.site.name}
                </div>
                <div className="text-sm text-gray-600 mt-1">โดย {r.user.name}</div>
                <div className="text-xs text-gray-400">
                  ส่งเมื่อ {r.submittedAt ? fmtDateTime(r.submittedAt) : "-"}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusBadge status={r.status} />
                {r.suspicious && (
                  <span className="badge bg-amber-100 text-amber-800">
                    ⚠️ น่าสงสัย
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
