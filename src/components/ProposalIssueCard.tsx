import Link from "next/link";
import { fmtDate, fmtDateTime, fmtDaySpan } from "@/lib/date";
import SelectProposalButton from "@/components/SelectProposalButton";

export type ProposalRow = {
  id: string;
  technician: string;
  price: number;
  startDate: Date | null;
  finishDate: Date | null;
  detail: string | null;
  attachmentCount: number;
  proposerName: string;
};

export type ProposalIssue = {
  id: string;
  detail: string;
  createdAt: Date;
  checkpointName: string;
  siteName: string;
  departmentName: string | null;
  proposals: ProposalRow[]; // เรียงตามราคาแล้ว (ถูก→แพง)
  waitingDays: number; // นับจากข้อเสนอแรกเข้า = ตอนที่ลูกบอลถึงมือผู้บริหาร
};

// ป้ายเตือนงานค้าง — เงียบไว้ถ้ายังไม่ถึง 3 วัน (ไม่งั้นทุกใบมีป้าย = ป้ายไร้ความหมาย)
function WaitBadge({ days }: { days: number }) {
  if (days < 3) return null;
  return days >= 7 ? (
    <span className="badge bg-rose-100 text-rose-800">🔴 ค้าง {days} วัน</span>
  ) : (
    <span className="badge bg-amber-100 text-amber-800">⏳ รอ {days} วัน</span>
  );
}

// การ์ด 1 งานซ่อม — เห็นข้อเสนอทุกอันเทียบกัน + กดอนุมัติได้เลยจากตรงนี้
// เป็น <div> ไม่ใช่ <Link> ครอบทั้งใบ เพราะมีปุ่มอยู่ข้างใน (<button> ใน <a> = HTML ผิด
// และบนมือถือแตะปุ่มจะกลายเป็นการนำทางแทน)
export default function ProposalIssueCard({
  issue,
}: {
  issue: ProposalIssue;
}) {
  const minPrice = issue.proposals.length
    ? Math.min(...issue.proposals.map((p) => p.price))
    : null;
  const multi = issue.proposals.length > 1;

  return (
    <div className="card p-4 space-y-3">
      {/* หัวงาน */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-gray-900 truncate">
            🛠️ {issue.checkpointName}
          </div>
          <div className="text-sm text-gray-500 truncate">
            {issue.departmentName ? `${issue.departmentName} · ` : ""}
            {issue.siteName}
          </div>
          <div className="text-gray-700 text-sm mt-1 line-clamp-2">
            {issue.detail}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            แจ้งเมื่อ {fmtDateTime(issue.createdAt)} · {issue.proposals.length}{" "}
            ข้อเสนอ
          </div>
        </div>
        <div className="shrink-0">
          <WaitBadge days={issue.waitingDays} />
        </div>
      </div>

      {/* ข้อเสนอ — เทียบกันได้ในที่เดียว */}
      <div className="divide-y divide-gray-100 border-t border-gray-100">
        {issue.proposals.map((p) => {
          const cheapest = multi && p.price === minPrice;
          return (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 py-2.5 flex-wrap"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {cheapest && (
                    <span className="badge bg-emerald-100 text-emerald-800">
                      🏆 ถูกสุด
                    </span>
                  )}
                  <span className="font-semibold text-brand-dark">
                    ฿{p.price.toLocaleString("th-TH")}
                  </span>
                  <span className="text-sm text-gray-700 truncate">
                    ช่าง {p.technician}
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {p.startDate || p.finishDate
                    ? `${p.startDate ? fmtDate(p.startDate) : "—"} → ${
                        p.finishDate ? fmtDate(p.finishDate) : "—"
                      } · ${fmtDaySpan(p.startDate, p.finishDate)} · `
                    : ""}
                  เสนอโดย {p.proposerName}
                  {p.attachmentCount > 0 ? ` · 📎${p.attachmentCount}` : ""}
                </div>
              </div>
              <SelectProposalButton
                proposalId={p.id}
                confirmLabel={`${issue.checkpointName}\nช่าง ${
                  p.technician
                } · ฿${p.price.toLocaleString("th-TH")}`}
              />
            </div>
          );
        })}
      </div>

      <div className="text-right">
        <Link
          href={`/issues/${issue.id}`}
          className="text-xs text-brand-dark font-medium hover:underline"
        >
          ดูรายละเอียด/รูป →
        </Link>
      </div>
    </div>
  );
}
