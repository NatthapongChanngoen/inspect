import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtDateTime } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function InspectorQueue() {
  const pending = await prisma.workRecord.findMany({
    where: { status: "SUBMITTED" },
    include: { checkpoint: { include: { site: true } }, user: true },
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
                <div className="text-sm text-gray-500">{r.checkpoint.site.name}</div>
                <div className="text-sm text-gray-600 mt-1">โดย {r.user.name}</div>
                <div className="text-xs text-gray-400">
                  ส่งเมื่อ {r.submittedAt ? fmtDateTime(r.submittedAt) : "-"}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="badge bg-blue-100 text-blue-800">รอตรวจ</span>
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
