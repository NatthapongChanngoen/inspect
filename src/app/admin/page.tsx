import Link from "next/link";
import {
  Clock,
  Hourglass,
  CheckCircle2,
  XCircle,
  Building2,
  MapPin,
  Users,
  ClipboardList,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { todayRange, fmtDateTime } from "@/lib/date";
import StatusBadge from "@/components/StatusBadge";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const { start, end } = todayRange();
  const todayWhere = { checkInAt: { gte: start, lt: end } };

  const [
    inProgress,
    submitted,
    approved,
    rejected,
    sites,
    checkpoints,
    staff,
    suspiciousToday,
    recent,
  ] = await Promise.all([
    prisma.workRecord.count({ where: { ...todayWhere, status: "IN_PROGRESS" } }),
    prisma.workRecord.count({ where: { ...todayWhere, status: "SUBMITTED" } }),
    prisma.workRecord.count({ where: { ...todayWhere, status: "APPROVED" } }),
    prisma.workRecord.count({ where: { ...todayWhere, status: "REJECTED" } }),
    prisma.site.count(),
    prisma.checkpoint.count(),
    prisma.user.count({ where: { role: "STAFF" } }),
    prisma.workRecord.count({ where: { ...todayWhere, suspicious: true } }),
    prisma.workRecord.findMany({
      where: todayWhere,
      include: { checkpoint: true, user: true },
      orderBy: { checkInAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">แดชบอร์ดวันนี้</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="กำลังทำงาน" value={inProgress} icon={Clock} accent="amber" />
        <StatCard label="รอตรวจ" value={submitted} icon={Hourglass} accent="blue" />
        <StatCard label="ผ่าน" value={approved} icon={CheckCircle2} accent="emerald" />
        <StatCard label="ไม่ผ่าน" value={rejected} icon={XCircle} accent="rose" />
      </div>

      {suspiciousToday > 0 && (
        <Link
          href="/admin/suspicious?range=today"
          className="rounded-xl p-4 flex items-center gap-3 border-2 border-amber-300 bg-amber-50 hover:bg-amber-100 transition-all duration-200"
        >
          <span className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center bg-amber-100 text-amber-600">
            <AlertTriangle size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-amber-800">
              พบ {suspiciousToday} รายการน่าสงสัยวันนี้
            </div>
            <div className="text-xs text-amber-700">
              อาจมีการปลอมตำแหน่ง (fake GPS) — แตะเพื่อตรวจสอบ
            </div>
          </div>
          <ArrowRight size={18} className="text-amber-600 shrink-0" />
        </Link>
      )}

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="สถานที่" value={sites} icon={Building2} accent="gray" />
        <StatCard label="จุดเช็คอิน" value={checkpoints} icon={MapPin} accent="gray" />
        <StatCard label="พนักงาน" value={staff} icon={Users} accent="gray" />
      </div>

      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <h2 className="font-semibold text-gray-800">งานล่าสุดวันนี้</h2>
          <div className="flex gap-2">
            <Link
              href="/inspector"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all duration-200"
            >
              <ClipboardList size={16} />
              ไปหน้าคิวตรวจ
            </Link>
            <Link
              href="/admin/assignments"
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <ArrowRight size={16} />
              มอบหมายงาน
            </Link>
          </div>
        </div>

        {recent.length === 0 ? (
          <EmptyState text="ยังไม่มีงานวันนี้" />
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-100">
            {recent.map((r) => (
              <div
                key={r.id}
                className="p-3 flex items-center justify-between gap-2"
              >
                <div>
                  <div className="font-medium text-sm text-gray-800">
                    {r.checkpoint.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {r.user.name} · {fmtDateTime(r.checkInAt)}
                  </div>
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
