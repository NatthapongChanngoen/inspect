import Link from "next/link";
import {
  Clock,
  Hourglass,
  CheckCircle2,
  XCircle,
  Ban,
  ArrowRight,
  AlertTriangle,
  CalendarDays,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { todayRange, fmtDate, fmtDateTime } from "@/lib/date";
import StatusBadge from "@/components/StatusBadge";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default async function TodayDashboard() {
  const { start, end } = todayRange();
  const todayWhere = { checkInAt: { gte: start, lt: end } };

  const [
    inProgress,
    submitted,
    approved,
    rejected,
    missed,
    suspicious,
    recent,
  ] = await Promise.all([
    prisma.workRecord.count({ where: { ...todayWhere, status: "IN_PROGRESS" } }),
    prisma.workRecord.count({ where: { ...todayWhere, status: "SUBMITTED" } }),
    prisma.workRecord.count({ where: { ...todayWhere, status: "APPROVED" } }),
    prisma.workRecord.count({ where: { ...todayWhere, status: "REJECTED" } }),
    prisma.workRecord.count({ where: { ...todayWhere, status: "MISSED" } }),
    prisma.workRecord.count({ where: { ...todayWhere, suspicious: true } }),
    prisma.workRecord.findMany({
      where: todayWhere,
      include: {
        checkpoint: { include: { site: true, department: true } },
        user: true,
      },
      orderBy: { checkInAt: "desc" },
      take: 30,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">แดชบอร์ดวันนี้</h1>
          <p className="text-sm text-gray-500 mt-0.5">สรุปงานเฉพาะวันนี้</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-dark bg-brand/10 rounded-full px-3 py-1.5">
          <CalendarDays size={15} />
          {fmtDate(start)}
        </span>
      </div>

      {suspicious > 0 && (
        <Link
          href="/admin/suspicious?range=today"
          className="rounded-xl p-4 flex items-center gap-3 border border-amber-300 bg-amber-50 hover:bg-amber-100 transition"
        >
          <span className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center bg-amber-100 text-amber-600">
            <AlertTriangle size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-amber-800">
              พบ {suspicious} รายการน่าสงสัยวันนี้
            </div>
            <div className="text-xs text-amber-700">
              อาจมีการปลอมตำแหน่ง (fake GPS) — แตะเพื่อตรวจสอบ
            </div>
          </div>
          <ArrowRight size={18} className="text-amber-600 shrink-0" />
        </Link>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="กำลังทำงาน" value={inProgress} icon={Clock} accent="amber" />
        <StatCard label="รอตรวจ" value={submitted} icon={Hourglass} accent="blue" />
        <StatCard label="ผ่าน" value={approved} icon={CheckCircle2} accent="emerald" />
        <StatCard label="ไม่ผ่าน" value={rejected} icon={XCircle} accent="rose" />
        <StatCard label="ไม่ได้ปฏิบัติงาน" value={missed} icon={Ban} accent="gray" />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            งานวันนี้
          </h2>
          <Link
            href="/inspector"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark shadow-sm transition"
          >
            <ArrowRight size={16} />
            ไปคิวตรวจ
          </Link>
        </div>

        {recent.length === 0 ? (
          <EmptyState text="วันนี้ยังไม่มีงาน" />
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="p-3 font-medium">พนักงาน</th>
                  <th className="p-3 font-medium">สถานที่ / จุด</th>
                  <th className="p-3 font-medium whitespace-nowrap">เช็คอิน</th>
                  <th className="p-3 font-medium">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recent.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="p-3 font-medium text-gray-800 whitespace-nowrap">
                      {r.user.name}
                    </td>
                    <td className="p-3 text-gray-600">
                      <div className="text-gray-800">{r.checkpoint.name}</div>
                      <div className="text-xs text-gray-400">
                        {r.checkpoint.department
                          ? `${r.checkpoint.department.name} · `
                          : ""}
                        {r.checkpoint.site.name}
                      </div>
                    </td>
                    <td className="p-3 text-gray-600 whitespace-nowrap">
                      {fmtDateTime(r.checkInAt)}
                    </td>
                    <td className="p-3">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
