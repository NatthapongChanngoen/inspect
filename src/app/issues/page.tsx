import Link from "next/link";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { fmtDateTime, daysSince } from "@/lib/date";
import { Prisma } from "@prisma/client";
import TabBar from "@/components/TabBar";
import KpiTile from "@/components/KpiTile";
import ProposalDeptFilter from "@/components/ProposalDeptFilter";
import ProposalIssueCard, {
  type ProposalIssue,
} from "@/components/ProposalIssueCard";

export const dynamic = "force-dynamic";

const baht = (n: number) => `${n.toLocaleString("th-TH")} ฿`;

const statusLabel: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "รอฝ่ายเสนอ", cls: "bg-rose-100 text-rose-800" },
  PROPOSED: { label: "มีข้อเสนอ", cls: "bg-amber-100 text-amber-800" },
  APPROVED: { label: "อนุมัติแล้ว", cls: "bg-blue-100 text-blue-800" },
  IN_PROGRESS: { label: "กำลังแก้ไข", cls: "bg-amber-100 text-amber-800" },
  RESOLVED: { label: "เสร็จแล้ว", cls: "bg-green-100 text-green-800" },
};

// ─── แดชบอร์ดสำหรับผู้บริหาร (งานซ่อม/ข้อเสนอ) ───
async function ExecutiveDashboard({
  searchParams,
  name,
}: {
  searchParams: Promise<{ sort?: string; departmentId?: string }>;
  name?: string | null;
}) {
  const sp = await searchParams;
  const fDept = sp.departmentId || "";
  const fSort = sp.sort === "price" || sp.sort === "count" ? sp.sort : "";

  const cpWhere = fDept ? { checkpoint: { departmentId: fDept } } : {};

  // ขอบเขตเดือนปัจจุบัน (KPI ใบที่ 3) — ใช้เวลาท้องถิ่นของเซิร์ฟเวอร์ (TZ=Asia/Bangkok)
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [rawProposed, departments, approvedThisMonth] = await Promise.all([
    // งานที่รอผู้บริหารเลือกข้อเสนอ — ไม่ใส่ take เพราะต้องเรียงใน memory
    // (take ก่อน = หยิบ 20 อันเก่าสุดแล้วค่อยเรียงราคา = ผิดความหมาย "ราคาสูงสุด"
    //  และ KPI จะไม่ตรงกับจำนวนการ์ด) · backlog รอเลือกมีขนาดเป็นสิบ รับได้
    prisma.issue.findMany({
      where: { type: "REPAIR", status: "PROPOSED", ...cpWhere },
      include: {
        checkpoint: { include: { site: true, department: true } },
        proposals: {
          select: {
            id: true,
            technician: true,
            price: true,
            startDate: true,
            finishDate: true,
            detail: true,
            attachmentPaths: true,
            createdAt: true,
            proposedBy: { select: { name: true } },
          },
          orderBy: [{ price: "asc" }, { createdAt: "asc" }],
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.department.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    // งบที่อนุมัติเดือนนี้ — นิยามเดียวกับ period.spendTotal/spendCount ใน
    // src/lib/repairReport.ts (approvedAt ในช่วง + REPAIR + ข้อเสนอที่ถูกเลือก)
    // ตั้งใจไม่ดู status: งานที่ซ่อมเสร็จ (RESOLVED) แล้วก็นับ — เงินอนุมัติไปแล้วจริง
    // → ตัวเลขจะตรงกับ "ค่าใช้จ่ายรวม" บน /admin/repairs เมื่อช่วง = เดือนปัจจุบัน
    prisma.issue.findMany({
      where: {
        type: "REPAIR",
        approvedAt: { gte: monthStart, lt: nextMonth },
        ...cpWhere,
      },
      select: { proposals: { where: { selected: true }, select: { price: true } } },
    }),
  ]);

  // งานที่ PROPOSED แต่ไม่มีข้อเสนอเลย = สถานะค้าง (ไม่มี guard ระดับ DB)
  // ต้องกรองทิ้งก่อน ไม่งั้น Math.min(...[]) = Infinity แล้ว KPI พังทั้งใบ
  const withProposals = rawProposed.filter((it) => it.proposals.length > 0);

  const issues: ProposalIssue[] = withProposals.map((it) => {
    const firstProposalAt = it.proposals.reduce(
      (min, p) => (p.createdAt < min ? p.createdAt : min),
      it.proposals[0].createdAt
    );
    return {
      id: it.id,
      detail: it.detail,
      createdAt: it.createdAt,
      checkpointName: it.checkpoint.name,
      siteName: it.checkpoint.site.name,
      departmentName: it.checkpoint.department?.name ?? null,
      proposals: it.proposals.map((p) => ({
        id: p.id,
        technician: p.technician,
        price: p.price,
        startDate: p.startDate,
        finishDate: p.finishDate,
        detail: p.detail,
        attachmentCount: p.attachmentPaths.length,
        proposerName: p.proposedBy.name,
      })),
      // นับจากข้อเสนอ "แรกสุด" = ตอนที่ลูกบอลถึงมือผู้บริหาร ไม่ใช่ issue.createdAt
      // (ไม่งั้นป้ายฟ้อง "ค้าง 20 วัน" ทั้งที่ฝ่ายเพิ่งเสนอเมื่อวาน = ความช้าของฝ่าย)
      // และห้ามใช้ข้อเสนอล่าสุด — เสนอเพิ่มได้ตอน PROPOSED → ใบที่ 3 จะรีเซ็ตนาฬิกา
      waitingDays: daysSince(firstProposalAt),
    };
  });

  const minOf = (it: ProposalIssue) => Math.min(...it.proposals.map((p) => p.price));
  const maxOf = (it: ProposalIssue) => Math.max(...it.proposals.map((p) => p.price));

  const sorted = [...issues];
  if (fSort === "price") sorted.sort((a, b) => minOf(b) - minOf(a));
  else if (fSort === "count")
    sorted.sort((a, b) => b.proposals.length - a.proposals.length);
  else sorted.sort((a, b) => b.waitingDays - a.waitingDays); // anchor เดียวกับป้ายค้างนาน

  const sumMin = issues.reduce((s, it) => s + minOf(it), 0);
  const sumMax = issues.reduce((s, it) => s + maxOf(it), 0);
  const approvedCount = approvedThisMonth.filter((it) => it.proposals[0]).length;
  const approvedSpend = approvedThisMonth.reduce(
    (s, it) => s + (it.proposals[0]?.price ?? 0),
    0
  );

  const deptName = fDept ? departments.find((d) => d.id === fDept)?.name ?? "" : "";

  return (
    <div className="space-y-4">
      {/* ── หัวแดชบอร์ด ── */}
      <div className="rounded-2xl bg-brand-darker text-white p-5 shadow-card">
        <div className="text-xs font-medium text-white/70">
          ระบบตรวจงาน · ผู้บริหาร
        </div>
        <h1 className="text-2xl font-bold mt-0.5">งานซ่อม (ข้อเสนอ)</h1>
        <p className="text-sm text-white/80 mt-1">
          {name ? `${name} · ` : ""}
          {deptName ? `ฝ่าย ${deptName}` : "ทุกฝ่าย"}
        </p>
      </div>

      {/* ── การ์ดตัวเลขหลัก ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiTile
          label="รอคุณเลือก (งาน)"
          value={issues.length}
          tone={issues.length > 0 ? "text-amber-600" : "text-gray-900"}
        />
        <KpiTile
          label="งบที่รอตัดสินใจ"
          value={baht(sumMin)}
          tone="text-orange-600"
          sub={
            <span className="text-xs text-gray-400">
              ถ้าเลือกถูกสุดทุกงาน · สูงสุด {baht(sumMax)}
            </span>
          }
        />
        <KpiTile
          label="อนุมัติแล้วเดือนนี้ (งาน)"
          value={approvedCount}
          tone="text-emerald-600"
          sub={
            <span className="text-xs text-gray-400">{baht(approvedSpend)}</span>
          }
        />
      </div>

      {/* ── ตัวกรอง ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <ProposalDeptFilter
          departments={departments}
          departmentId={fDept}
          sort={fSort}
        />
      </div>
      <TabBar
        basePath="/issues"
        paramName="sort"
        current={fSort}
        tabs={[
          { key: "count", label: "จำนวนข้อเสนอ" },
          { key: "price", label: "ราคาสูงสุด" },
          { key: "", label: "รอนานสุด" },
        ]}
        params={{ departmentId: fDept }}
      />

      {/* ── รายการรอตัดสินใจ ── */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          รอคุณเลือกข้อเสนอ ({issues.length})
        </h2>
        {sorted.length === 0 ? (
          <div className="card p-8 text-center text-gray-400 text-sm">
            ✓ ไม่มีงานที่รอคุณเลือกข้อเสนอ
            {deptName ? ` ในฝ่าย ${deptName}` : ""}
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((it) => (
              <ProposalIssueCard key={it.id} issue={it} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default async function IssuesListPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; departmentId?: string }>;
}) {
  const me = await currentUser();
  if (!me) return null;

  // ผู้บริหารเห็นเป็นแดชบอร์ด (ส่ง promise ต่อ ไม่ await ที่นี่ — branch ล่างไม่ต้องแตะ)
  if (me.role === "EXECUTIVE")
    return <ExecutiveDashboard searchParams={searchParams} name={me.name} />;

  const meDb = await prisma.user.findUnique({
    where: { id: me.id },
    select: { departmentId: true },
  });

  const isAdmin = me.role === "ADMIN";

  // ขอบเขตงานที่แต่ละบทบาทเห็น
  let where: Prisma.IssueWhereInput;
  if (isAdmin) where = {};
  else if (meDb?.departmentId)
    where = { checkpoint: { departmentId: meDb.departmentId } };
  else where = { reportedById: me.id };

  const issues = await prisma.issue.findMany({
    where,
    include: { checkpoint: { include: { site: true, department: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      {isAdmin && (
        <Link
          href="/admin"
          className="text-sm text-brand-dark font-medium hover:underline"
        >
          ← กลับแดชบอร์ด
        </Link>
      )}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">งานซ่อม / แจ้งปัญหา</h1>
        <Link href="/staff/report" className="text-sm text-brand-dark font-medium">
          ＋ แจ้งปัญหา
        </Link>
      </div>

      {issues.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          ยังไม่มีงานที่เกี่ยวข้องกับคุณ
        </div>
      ) : (
        <div className="space-y-2">
          {issues.map((it) => (
            <Link
              key={it.id}
              href={`/issues/${it.id}`}
              className="card p-4 block hover:bg-gray-50"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 truncate">
                    {it.type === "REPAIR" ? "🛠️" : "📦"} {it.checkpoint.name}
                  </div>
                  <div className="text-sm text-gray-500 truncate">
                    {it.checkpoint.department
                      ? `${it.checkpoint.department.name} · `
                      : ""}
                    {it.checkpoint.site.name}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {fmtDateTime(it.createdAt)}
                  </div>
                </div>
                <span className={`badge shrink-0 ${statusLabel[it.status].cls}`}>
                  {statusLabel[it.status].label}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
