import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { fmtDate, fmtDateTime } from "@/lib/date";
import ImageThumb from "@/components/ImageThumb";
import RepairProposalForm from "@/components/RepairProposalForm";
import SelectProposalButton from "@/components/SelectProposalButton";
import CompleteRepairForm from "@/components/CompleteRepairForm";
import AcceptSupplyButton from "@/components/AcceptSupplyButton";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "รอฝ่ายเสนอ", cls: "bg-rose-100 text-rose-800" },
  PROPOSED: { label: "มีข้อเสนอ รอผู้บริหาร", cls: "bg-amber-100 text-amber-800" },
  APPROVED: { label: "อนุมัติแล้ว รอซ่อม", cls: "bg-blue-100 text-blue-800" },
  IN_PROGRESS: { label: "กำลังแก้ไข", cls: "bg-amber-100 text-amber-800" },
  RESOLVED: { label: "เสร็จแล้ว", cls: "bg-green-100 text-green-800" },
};
const typeLabel: Record<string, string> = {
  REPAIR: "🛠️ ซ่อมอุปกรณ์",
  SUPPLY: "📦 ของหมด",
};

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await currentUser();
  if (!me) notFound();

  const [issue, meDb] = await Promise.all([
    prisma.issue.findUnique({
      where: { id },
      include: {
        checkpoint: { include: { site: true, department: true } },
        reportedBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
        resolvedBy: { select: { name: true } },
        acceptedBy: { select: { name: true } },
        proposals: {
          include: { proposedBy: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.user.findUnique({
      where: { id: me.id },
      select: { departmentId: true },
    }),
  ]);
  if (!issue) notFound();

  const isAdmin = me.role === "ADMIN";
  const isDeptMember =
    !!meDb?.departmentId &&
    meDb.departmentId === issue.checkpoint.departmentId;
  const isRepair = issue.type === "REPAIR";
  const canPropose =
    isRepair &&
    (isDeptMember || isAdmin) &&
    (issue.status === "OPEN" || issue.status === "PROPOSED");
  // เลือกข้อเสนอ = เฉพาะผู้บริหารเท่านั้น (แอดมินดูได้แต่ไม่มีปุ่ม)
  const canSelect =
    isRepair && me.role === "EXECUTIVE" && issue.status === "PROPOSED";
  const canComplete =
    isRepair && (isDeptMember || isAdmin) && issue.status === "APPROVED";
  const selected = issue.proposals.find((p) => p.selected) || null;
  // ── ของหมด (SUPPLY): ฝ่ายรับเรื่อง → ส่งหลักฐานว่าเติมแล้ว ──
  const isSupply = issue.type === "SUPPLY";
  const canAcceptSupply =
    isSupply && (isDeptMember || isAdmin) && issue.status === "OPEN";
  const canRefillSupply =
    isSupply && (isDeptMember || isAdmin) && issue.status === "IN_PROGRESS";

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <Link href="/issues" className="text-sm text-gray-500">
        ← กลับรายการงานซ่อม
      </Link>

      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">{issue.checkpoint.name}</h1>
          <p className="text-sm text-gray-500">
            {issue.checkpoint.department
              ? `${issue.checkpoint.department.name} · `
              : ""}
            {issue.checkpoint.site.name}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {typeLabel[issue.type]} · แจ้งโดย{" "}
            {issue.reportedBy?.name ?? issue.reporterName ?? "ผู้แจ้งภายนอก"} ·{" "}
            {fmtDateTime(issue.createdAt)}
          </p>
        </div>
        <span className={`badge ${statusLabel[issue.status].cls}`}>
          {statusLabel[issue.status].label}
        </span>
      </div>

      <div className="card p-4 text-sm text-gray-700 whitespace-pre-wrap">
        {issue.detail}
      </div>
      {issue.photoPath && (
        <ImageThumb src={`/api/files/${issue.photoPath}`} alt="รูปแจ้งปัญหา" />
      )}

      {/* ── ของหมด (SUPPLY): รับเรื่อง → ส่งหลักฐานว่าเติมแล้ว ── */}
      {isSupply && issue.acceptedBy && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          📥 รับเรื่องแล้ว — โดย {issue.acceptedBy.name}
          {issue.acceptedAt ? ` · ${fmtDateTime(issue.acceptedAt)}` : ""}
        </div>
      )}
      {canAcceptSupply && <AcceptSupplyButton issueId={issue.id} />}
      {canRefillSupply && (
        <section className="card p-4 space-y-2">
          <h2 className="text-sm font-semibold text-gray-800">
            ส่งหลักฐานว่าเติมแล้ว — ถ่ายรูปหลังเติมของ
          </h2>
          <CompleteRepairForm issueId={issue.id} />
        </section>
      )}

      {isRepair && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-800">
            ข้อเสนอซ่อม ({issue.proposals.length})
          </h2>
          {issue.proposals.length === 0 ? (
            <div className="card p-4 text-sm text-gray-500 text-center">
              ยังไม่มีข้อเสนอ
            </div>
          ) : (
            <div className="space-y-2">
              {issue.proposals.map((p) => (
                <div
                  key={p.id}
                  className={`card p-3 ${
                    p.selected ? "border-2 border-emerald-400 bg-emerald-50" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-sm">
                      เสนอโดย {p.proposedBy.name}
                      {p.selected && (
                        <span className="badge bg-emerald-100 text-emerald-800 ml-2">
                          เลือกแล้ว
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-brand-dark">
                        ฿{p.price.toLocaleString("th-TH")}
                      </span>
                      {canSelect && !p.selected && (
                        <SelectProposalButton proposalId={p.id} />
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    ช่าง: {p.technician}
                    {p.startDate ? ` · เข้าซ่อม ${fmtDate(p.startDate)}` : ""}
                    {p.finishDate ? ` · เสร็จ ${fmtDate(p.finishDate)}` : ""}
                  </div>
                  {p.detail && (
                    <div className="text-sm text-gray-700 mt-1">{p.detail}</div>
                  )}
                  {p.attachmentPaths.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs text-gray-400 mb-1">
                        เอกสารแนบ ({p.attachmentPaths.length})
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {p.attachmentPaths.map((path, i) =>
                          /\.(jpe?g|png|webp|heic|heif)$/i.test(path) ? (
                            <ImageThumb
                              key={path}
                              src={`/api/files/${path}`}
                              alt="เอกสารแนบข้อเสนอ"
                              thumbClassName="h-24 w-24 rounded-lg border object-cover bg-gray-50 cursor-zoom-in hover:opacity-90 transition"
                            />
                          ) : (
                            <a
                              key={path}
                              href={`/api/files/${path}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-sm text-brand-dark font-medium hover:underline border rounded-lg px-3 py-2 bg-gray-50"
                            >
                              📄 เอกสาร {i + 1}
                            </a>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {canPropose && (
        <section className="card p-4 space-y-2">
          <h2 className="text-sm font-semibold text-gray-800">เสนอราคาซ่อม</h2>
          <RepairProposalForm issueId={issue.id} />
        </section>
      )}

      {selected &&
        (issue.status === "APPROVED" || issue.status === "RESOLVED") && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            ✓ อนุมัติแล้ว — เลือกข้อเสนอของ {selected.proposedBy.name} · ช่าง{" "}
            {selected.technician} · ฿{selected.price.toLocaleString("th-TH")}
            {issue.approvedBy ? ` · โดย ${issue.approvedBy.name}` : ""}
          </div>
        )}

      {canComplete && (
        <section className="card p-4 space-y-2">
          <h2 className="text-sm font-semibold text-gray-800">
            ปิดงาน — ถ่ายรูปหลังซ่อมเสร็จ
          </h2>
          <CompleteRepairForm issueId={issue.id} />
        </section>
      )}

      {issue.status === "RESOLVED" && issue.completionPhotoPath && (
        <section className="space-y-1">
          <h2 className="text-sm font-semibold text-gray-800">
            รูปหลักฐานหลังซ่อม
          </h2>
          <ImageThumb
            src={`/api/files/${issue.completionPhotoPath}`}
            alt="หลังซ่อม"
          />
          <p className="text-xs text-gray-400">
            ปิดงานเมื่อ{" "}
            {issue.resolvedAt ? fmtDateTime(issue.resolvedAt) : "-"}
            {issue.resolvedBy ? ` · โดย ${issue.resolvedBy.name}` : ""}
          </p>
        </section>
      )}
    </div>
  );
}
