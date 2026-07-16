import Link from "next/link";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { fmtDateTime } from "@/lib/date";
import StatusBadge from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const user = await currentUser();
  if (!user) return null;

  const records = await prisma.workRecord.findMany({
    where: { userId: user.id },
    include: { checkpoint: { include: { site: true, department: true } } },
    orderBy: { checkInAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <Link href="/staff" className="text-sm text-gray-500">
        ← กลับ
      </Link>
      <h1 className="text-xl font-bold">ประวัติงาน</h1>

      {records.length === 0 && (
        <div className="card p-6 text-center text-gray-500">ยังไม่มีประวัติงาน</div>
      )}

      <div className="space-y-3">
        {records.map((r) => (
          <Link key={r.id} href={`/staff/work/${r.id}`} className="card p-4 block">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{r.checkpoint.name}</div>
                <div className="text-sm text-gray-500">
                  {r.checkpoint.department
                    ? `${r.checkpoint.department.name} · `
                    : ""}
                  {r.checkpoint.site.name}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {fmtDateTime(r.checkInAt)}
                </div>
              </div>
              <StatusBadge status={r.status} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
