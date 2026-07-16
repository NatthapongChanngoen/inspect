import {
  ClipboardList,
  Hourglass,
  RefreshCw,
  CheckCircle2,
  Wrench,
  Package,
} from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtDateTime } from "@/lib/date";
import { Prisma } from "@prisma/client";
import EmptyState from "@/components/EmptyState";
import StatCard from "@/components/StatCard";
import IssueFilters from "@/components/IssueFilters";
import ImageThumb from "@/components/ImageThumb";
import { updateIssueStatus, deleteIssue } from "../actions";

export const dynamic = "force-dynamic";

const typeLabel: Record<string, { label: string; cls: string }> = {
  REPAIR: { label: "🛠️ ซ่อมอุปกรณ์", cls: "bg-amber-100 text-amber-800" },
  SUPPLY: { label: "📦 ของหมด", cls: "bg-blue-100 text-blue-800" },
};

const statusLabel: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "รอดำเนินการ", cls: "bg-rose-100 text-rose-800" },
  PROPOSED: { label: "มีข้อเสนอ", cls: "bg-amber-100 text-amber-800" },
  APPROVED: { label: "อนุมัติแล้ว", cls: "bg-blue-100 text-blue-800" },
  IN_PROGRESS: { label: "กำลังแก้ไข", cls: "bg-amber-100 text-amber-800" },
  RESOLVED: { label: "เสร็จแล้ว", cls: "bg-green-100 text-green-800" },
};

export default async function AdminIssuesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string }>;
}) {
  const sp = await searchParams;
  const fStatus = sp.status || "";
  const fType = sp.type || "";

  const where: Prisma.IssueWhereInput = {};
  if (fStatus === "OPEN" || fStatus === "IN_PROGRESS" || fStatus === "RESOLVED")
    where.status = fStatus;
  if (fType === "REPAIR" || fType === "SUPPLY") where.type = fType;

  const [issues, statusGroups, typeGroups] = await Promise.all([
    prisma.issue.findMany({
      where,
      include: {
        checkpoint: { include: { site: true, department: true } },
        reportedBy: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.issue.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.issue.groupBy({ by: ["type"], _count: { _all: true } }),
  ]);

  const cntStatus = (s: string) =>
    statusGroups.find((g) => g.status === s)?._count._all ?? 0;
  const cntType = (t: string) =>
    typeGroups.find((g) => g.type === t)?._count._all ?? 0;
  const totalIssues = statusGroups.reduce((a, g) => a + g._count._all, 0);
  const openCount = cntStatus("OPEN");

  // ลิงก์การ์ดสรุป → กรองรายการด้านล่าง (คงตัวกรองอีกฝั่งไว้)
  function cardHref(next: { status?: string; type?: string }): string {
    const params = new URLSearchParams();
    const status = "status" in next ? next.status : fStatus;
    const type = "type" in next ? next.type : fType;
    if (status) params.set("status", status);
    if (type) params.set("type", type);
    const qs = params.toString();
    return qs ? `/admin/issues?${qs}` : "/admin/issues";
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">แจ้งซ่อม / ของหมด</h1>
        {openCount > 0 && (
          <span className="badge bg-rose-100 text-rose-800">
            รอดำเนินการ {openCount}
          </span>
        )}
      </div>

      {/* ===== แถบสรุป ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="ทั้งหมด"
          value={totalIssues}
          icon={ClipboardList}
          accent="gray"
          href={cardHref({ status: "", type: "" })}
          active={!fStatus && !fType}
        />
        <StatCard
          label="รอดำเนินการ"
          value={cntStatus("OPEN")}
          icon={Hourglass}
          accent="rose"
          href={cardHref({ status: "OPEN" })}
          active={fStatus === "OPEN"}
        />
        <StatCard
          label="กำลังแก้ไข"
          value={cntStatus("IN_PROGRESS")}
          icon={RefreshCw}
          accent="amber"
          href={cardHref({ status: "IN_PROGRESS" })}
          active={fStatus === "IN_PROGRESS"}
        />
        <StatCard
          label="เสร็จแล้ว"
          value={cntStatus("RESOLVED")}
          icon={CheckCircle2}
          accent="emerald"
          href={cardHref({ status: "RESOLVED" })}
          active={fStatus === "RESOLVED"}
        />
        <StatCard
          label="ซ่อมอุปกรณ์"
          value={cntType("REPAIR")}
          icon={Wrench}
          accent="orange"
          href={cardHref({ type: "REPAIR" })}
          active={fType === "REPAIR"}
        />
        <StatCard
          label="ของหมด"
          value={cntType("SUPPLY")}
          icon={Package}
          accent="blue"
          href={cardHref({ type: "SUPPLY" })}
          active={fType === "SUPPLY"}
        />
      </div>

      {/* ตัวกรอง — เลือกแล้วกรองทันที */}
      <IssueFilters type={fType} status={fStatus} />

      {issues.length === 0 ? (
        <EmptyState text="ยังไม่มีการแจ้งปัญหา" />
      ) : (
        <div className="space-y-3">
          {issues.map((it) => (
            <div key={it.id} className="card p-4 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className={`badge ${typeLabel[it.type].cls}`}>
                    {typeLabel[it.type].label}
                  </span>
                  <span className={`badge ${statusLabel[it.status].cls}`}>
                    {statusLabel[it.status].label}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {fmtDateTime(it.createdAt)}
                </span>
              </div>

              <div className="text-sm text-gray-800">
                {it.checkpoint.department
                  ? `${it.checkpoint.department.name} · `
                  : ""}
                {it.checkpoint.site.name} · {it.checkpoint.name}
              </div>
              <div className="text-sm text-gray-700 whitespace-pre-wrap">
                {it.detail}
              </div>
              <div className="text-xs text-gray-400">
                แจ้งโดย {it.reportedBy?.name ?? it.reporterName ?? "ผู้แจ้งภายนอก"}
                {it.resolvedAt
                  ? ` · เสร็จเมื่อ ${fmtDateTime(it.resolvedAt)}`
                  : ""}
              </div>

              {it.photoPath && (
                <ImageThumb
                  src={`/api/files/${it.photoPath}`}
                  alt="รูปแจ้งปัญหา"
                />
              )}

              <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                <Link
                  href={`/issues/${it.id}`}
                  className="btn-ghost !py-1.5 text-sm text-brand-dark whitespace-nowrap"
                >
                  จัดการ →
                </Link>
                <form
                  action={updateIssueStatus}
                  className="flex items-center gap-2 flex-1"
                >
                  <input type="hidden" name="id" value={it.id} />
                  <select
                    name="status"
                    defaultValue={it.status}
                    className="input !py-1.5 !w-36 text-sm"
                  >
                    <option value="OPEN">รอดำเนินการ</option>
                    <option value="IN_PROGRESS">กำลังแก้ไข</option>
                    <option value="RESOLVED">เสร็จแล้ว</option>
                  </select>
                  <input
                    name="resolveNote"
                    defaultValue={it.resolveNote ?? ""}
                    placeholder="หมายเหตุ (ถ้ามี)"
                    className="input !py-1.5 text-sm flex-1"
                  />
                  <button className="btn-primary !py-1.5 text-sm">บันทึก</button>
                </form>
                <form action={deleteIssue}>
                  <input type="hidden" name="id" value={it.id} />
                  <button className="btn-ghost !py-1.5 text-sm text-red-600">
                    ลบ
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
