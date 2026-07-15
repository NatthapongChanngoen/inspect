import Link from "next/link";
import {
  Hourglass,
  CheckCircle2,
  XCircle,
  Ban,
  ArrowRight,
  ListChecks,
  Activity,
  EyeOff,
} from "lucide-react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fmtDate, fmtDateTime } from "@/lib/date";
import StatusBadge from "@/components/StatusBadge";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import RecentFilters from "@/components/RecentFilters";
import ReportDetailButton from "@/components/ReportDetailButton";

export const dynamic = "force-dynamic";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
      {children}
    </h2>
  );
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    userId?: string;
    staffType?: string;
    departmentId?: string;
    checkpointId?: string;
    status?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const fQ = (sp.q || "").trim();
  const fUser = sp.userId || "";
  const fStaffType = sp.staffType || "";
  const fDepartment = sp.departmentId || "";
  const fCheckpoint = sp.checkpointId || "";
  const fStatus = sp.status || "";
  const pageNum = Math.max(1, parseInt(sp.page || "1", 10) || 1);

  // การ์ดสถิติสะสม — ผูกกับตัวกรองประเภทพนักงาน (แม่บ้าน/รปภ.) ที่เลือก
  const statWhere: Prisma.WorkRecordWhereInput = fStaffType
    ? { user: { staffType: fStaffType as "HOUSEKEEPER" | "SECURITY" } }
    : {};

  // เงื่อนไขกรองตาราง "งานล่าสุด"
  const recentWhere: Prisma.WorkRecordWhereInput = {};
  if (fUser) recentWhere.userId = fUser;
  if (fStaffType)
    recentWhere.user = {
      staffType: fStaffType as "HOUSEKEEPER" | "SECURITY",
    };
  if (fCheckpoint) recentWhere.checkpointId = fCheckpoint;
  if (fDepartment) recentWhere.checkpoint = { departmentId: fDepartment };
  if (fStatus)
    recentWhere.status = fStatus as Prisma.WorkRecordWhereInput["status"];
  if (fQ) {
    recentWhere.OR = [
      { user: { name: { contains: fQ, mode: "insensitive" } } },
      { checkpoint: { name: { contains: fQ, mode: "insensitive" } } },
      { checkpoint: { site: { name: { contains: fQ, mode: "insensitive" } } } },
    ];
  }
  // แบ่งหน้าเป็นช่วง 31 วันต่อหน้า ไล่ย้อนหลัง (คอนเทนเนอร์ TZ=Asia/Bangkok → เวลาไทย)
  const SPAN = 31;
  const now = new Date();
  const lower = new Date(now);
  lower.setDate(lower.getDate() - SPAN * pageNum);
  const upper = new Date(now);
  upper.setDate(upper.getDate() - SPAN * (pageNum - 1));
  recentWhere.checkInAt =
    pageNum === 1 ? { gte: lower } : { gte: lower, lt: upper };

  const [
    // ----- สะสมทั้งหมด -----
    totalWork,
    allApproved,
    allRejected,
    allMissed,
    pendingReview,
    allNotReviewed,
    // ----- รายการ + ตัวเลือกกรอง -----
    recent,
    olderRecord,
    staffList,
    checkpointList,
    departmentList,
  ] = await Promise.all([
    prisma.workRecord.count({ where: statWhere }),
    prisma.workRecord.count({ where: { ...statWhere, status: "APPROVED" } }),
    prisma.workRecord.count({ where: { ...statWhere, status: "REJECTED" } }),
    prisma.workRecord.count({ where: { ...statWhere, status: "MISSED" } }),
    prisma.workRecord.count({ where: { ...statWhere, status: "SUBMITTED" } }),
    prisma.workRecord.count({ where: { ...statWhere, status: "NOT_REVIEWED" } }),

    prisma.workRecord.findMany({
      where: recentWhere,
      include: {
        checkpoint: { include: { site: true, department: true } },
        user: true,
        review: true,
      },
      orderBy: { checkInAt: "desc" },
      take: 500,
    }),
    // มีงานเก่ากว่าช่วงนี้ไหม (คงตัวกรองอื่น) → ใช้ตัดสินว่ามีหน้าถัดไป
    prisma.workRecord.findFirst({
      where: { ...recentWhere, checkInAt: { lt: lower } },
      select: { id: true },
    }),
    prisma.user.findMany({
      where: { role: "STAFF" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.checkpoint.findMany({
      include: { site: true, department: true },
      orderBy: { name: "asc" },
    }),
    prisma.department.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const hasFilter = !!(
    fQ ||
    fUser ||
    fStaffType ||
    fDepartment ||
    fCheckpoint ||
    fStatus
  );
  const hasNext = !!olderRecord;
  const hasPrev = pageNum > 1;

  // ลิงก์การ์ดสถิติ → กรองตาราง "งานล่าสุด" ตามสถานะ (คงตัวกรองอื่นไว้, กลับหน้า 1)
  function cardHref(status?: string): string {
    const params = new URLSearchParams();
    if (fQ) params.set("q", fQ);
    if (fUser) params.set("userId", fUser);
    if (fStaffType) params.set("staffType", fStaffType);
    if (fDepartment) params.set("departmentId", fDepartment);
    if (fCheckpoint) params.set("checkpointId", fCheckpoint);
    if (status) params.set("status", status);
    const qs = params.toString();
    return qs ? `/admin?${qs}` : "/admin";
  }

  // ลิงก์เปลี่ยนหน้า (คงตัวกรองทั้งหมดไว้)
  function pageHref(p: number): string {
    const params = new URLSearchParams();
    if (fQ) params.set("q", fQ);
    if (fUser) params.set("userId", fUser);
    if (fStaffType) params.set("staffType", fStaffType);
    if (fDepartment) params.set("departmentId", fDepartment);
    if (fCheckpoint) params.set("checkpointId", fCheckpoint);
    if (fStatus) params.set("status", fStatus);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/admin?${qs}` : "/admin";
  }

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">แดชบอร์ด</h1>
        <p className="text-sm text-gray-500 mt-0.5">ภาพรวมทั้งระบบ</p>
      </div>

      {/* ===== แจ้งเตือน ===== */}
      {pendingReview > 0 && (
        <Link
          href="/inspector"
          className="rounded-xl p-4 flex items-center gap-3 border border-blue-200 bg-blue-50 hover:bg-blue-100 transition"
        >
          <span className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center bg-blue-100 text-blue-600">
            <ListChecks size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-blue-800">
              มี {pendingReview} งานรอตรวจ
            </div>
            <div className="text-xs text-blue-700">แตะเพื่อไปหน้าคิวตรวจ</div>
          </div>
          <ArrowRight size={18} className="text-blue-600 shrink-0" />
        </Link>
      )}

      {/* ===== สถิติสะสม ===== */}
      <section className="space-y-3">
        <SectionTitle>
          สถิติสะสม (
          {fStaffType === "HOUSEKEEPER"
            ? "แม่บ้าน"
            : fStaffType === "SECURITY"
            ? "รปภ."
            : "ทั้งหมด"}
          )
        </SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            label="งานทั้งหมด"
            value={totalWork}
            icon={Activity}
            accent="blue"
            href={cardHref()}
            active={!fStatus}
          />
          <StatCard
            label="ผ่าน"
            value={allApproved}
            icon={CheckCircle2}
            accent="emerald"
            href={cardHref("APPROVED")}
            active={fStatus === "APPROVED"}
          />
          <StatCard
            label="ไม่ผ่าน"
            value={allRejected}
            icon={XCircle}
            accent="rose"
            href={cardHref("REJECTED")}
            active={fStatus === "REJECTED"}
          />
          <StatCard
            label="ไม่ได้ปฏิบัติงาน"
            value={allMissed}
            icon={Ban}
            accent="amber"
            href={cardHref("MISSED")}
            active={fStatus === "MISSED"}
          />
          <StatCard
            label="รอตรวจ"
            value={pendingReview}
            icon={Hourglass}
            accent="blue"
            href={cardHref("SUBMITTED")}
            active={fStatus === "SUBMITTED"}
          />
          <StatCard
            label="ไม่ได้รับการตรวจ"
            value={allNotReviewed}
            icon={EyeOff}
            accent="orange"
            href={cardHref("NOT_REVIEWED")}
            active={fStatus === "NOT_REVIEWED"}
          />
        </div>
      </section>

      {/* ===== งานล่าสุด ===== */}
      <section className="space-y-3">
        <SectionTitle>งานล่าสุด</SectionTitle>
        <p className="text-xs text-gray-400 -mt-1">
          หน้า {pageNum} · ช่วง {fmtDate(lower)} –{" "}
          {pageNum === 1 ? "วันนี้" : fmtDate(upper)}
        </p>

        {/* ===== ค้นหา / กรอง (เลือกแล้วกรองทันที ไม่ต้องกดปุ่ม) ===== */}
        <RecentFilters
          staffList={staffList}
          checkpointList={checkpointList}
          departmentList={departmentList}
          q={fQ}
          userId={fUser}
          staffType={fStaffType}
          departmentId={fDepartment}
          checkpointId={fCheckpoint}
          status={fStatus}
        />

        {hasFilter && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>แสดงผลตามตัวกรอง</span>
            <Link href="/admin" className="text-brand-dark hover:underline">
              ล้างตัวกรอง
            </Link>
          </div>
        )}

        {recent.length === 0 ? (
          <EmptyState
            text={
              hasFilter
                ? "ไม่พบงานตามเงื่อนไข"
                : pageNum > 1
                ? "ไม่มีงานในช่วงนี้"
                : "ยังไม่มีข้อมูลงาน"
            }
          />
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="p-3 font-medium">พนักงาน</th>
                  <th className="p-3 font-medium">สถานที่ / จุด</th>
                  <th className="p-3 font-medium whitespace-nowrap">เช็คอิน</th>
                  <th className="p-3 font-medium">สถานะ</th>
                  <th className="p-3 font-medium text-right">รายละเอียด</th>
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
                    <td className="p-3 text-right">
                      <ReportDetailButton record={r} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* แบ่งหน้า (หน้าละ 31 วัน) */}
        {(hasPrev || hasNext) && (
          <div className="flex items-center justify-between gap-2">
            {hasPrev ? (
              <Link
                href={pageHref(pageNum - 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-brand-dark hover:border-brand hover:bg-brand/5 transition"
              >
                ← ใหม่กว่า
              </Link>
            ) : (
              <span />
            )}
            <span className="text-xs text-gray-400">หน้า {pageNum}</span>
            {hasNext ? (
              <Link
                href={pageHref(pageNum + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-brand-dark hover:border-brand hover:bg-brand/5 transition"
              >
                เก่ากว่า →
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}
      </section>
    </div>
  );
}
