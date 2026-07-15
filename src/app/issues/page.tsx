import Link from "next/link";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { fmtDateTime } from "@/lib/date";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "รอฝ่ายเสนอ", cls: "bg-rose-100 text-rose-800" },
  PROPOSED: { label: "มีข้อเสนอ", cls: "bg-amber-100 text-amber-800" },
  APPROVED: { label: "อนุมัติแล้ว", cls: "bg-blue-100 text-blue-800" },
  IN_PROGRESS: { label: "กำลังแก้ไข", cls: "bg-amber-100 text-amber-800" },
  RESOLVED: { label: "เสร็จแล้ว", cls: "bg-green-100 text-green-800" },
};

// ─── แดชบอร์ดสำหรับผู้บริหาร (งานซ่อม/ข้อเสนอ) ───
async function ExecutiveDashboard() {
  // งานที่รอผู้บริหารเลือกข้อเสนอ (การตัดสินใจของผู้บริหาร)
  const proposedIssues = await prisma.issue.findMany({
    where: { type: "REPAIR", status: "PROPOSED" },
    include: {
      checkpoint: { include: { site: true, department: true } },
      proposals: {
        select: { id: true, technician: true, price: true },
        orderBy: { price: "asc" },
      },
    },
    orderBy: { createdAt: "asc" }, // รอนานสุดขึ้นก่อน
  });
  const proposedCount = proposedIssues.length;

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-5">
      <div>
        <Link
          href="/admin/executive"
          className="text-sm text-brand-dark font-medium hover:underline"
        >
          ← กลับรายงานผู้บริหาร
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">งานซ่อม (ข้อเสนอ)</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          งานซ่อมที่มีข้อเสนอเข้ามา รอคุณเลือกข้อเสนอ
        </p>
      </div>

      {/* รอคุณเลือกข้อเสนอ */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          รอคุณเลือกข้อเสนอ ({proposedCount})
        </h2>
        {proposedIssues.length === 0 ? (
          <div className="card p-8 text-center text-gray-400 text-sm">
            ✓ ไม่มีงานที่รอคุณเลือกข้อเสนอ
          </div>
        ) : (
          <div className="space-y-2">
            {proposedIssues.map((it) => {
              const prices = it.proposals.map((p) => p.price);
              const min = prices.length ? Math.min(...prices) : null;
              const max = prices.length ? Math.max(...prices) : null;
              return (
                <Link
                  key={it.id}
                  href={`/issues/${it.id}`}
                  className="card p-4 block hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        🛠️ {it.checkpoint.name}
                      </div>
                      <div className="text-sm text-gray-500 truncate">
                        {it.checkpoint.department
                          ? `${it.checkpoint.department.name} · `
                          : ""}
                        {it.checkpoint.site.name}
                      </div>
                      <div className="text-gray-700 text-sm mt-1 line-clamp-2">
                        {it.detail}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        แจ้งเมื่อ {fmtDateTime(it.createdAt)}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="badge bg-amber-100 text-amber-800">
                        {it.proposals.length} ข้อเสนอ
                      </span>
                      {min != null && (
                        <div className="text-xs text-gray-500 mt-1 whitespace-nowrap">
                          {min === max
                            ? `${min.toLocaleString("th-TH")} บาท`
                            : `${min.toLocaleString("th-TH")}–${max!.toLocaleString(
                                "th-TH"
                              )} บาท`}
                        </div>
                      )}
                      <div className="text-xs text-brand-dark font-medium mt-1">
                        เลือกข้อเสนอ →
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default async function IssuesListPage() {
  const me = await currentUser();
  if (!me) return null;

  // ผู้บริหารเห็นเป็นแดชบอร์ด
  if (me.role === "EXECUTIVE") return <ExecutiveDashboard />;

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
