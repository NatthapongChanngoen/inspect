import { getExecutiveReport } from "@/lib/report";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { fmtDate, fmtDateTime, fmtDuration, lateInfo } from "@/lib/date";
import StatusBadge from "@/components/StatusBadge";
import ReportDetailButton from "@/components/ReportDetailButton";
import ReportRangeFilter from "@/components/ReportRangeFilter";
import ExecutiveDeptFilter from "@/components/ExecutiveDeptFilter";
import TabBar from "@/components/TabBar";
import RangePills from "@/components/RangePills";
import DailyTrendChart from "@/components/DailyTrendChart";
import PassBar from "@/components/PassBar";
import KpiTile from "@/components/KpiTile";

export const dynamic = "force-dynamic";

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

const typeLabel: Record<string, string> = {
  HOUSEKEEPER: "แม่บ้าน",
  SECURITY: "รปภ.",
};

const issueTypeLabel: Record<string, string> = {
  REPAIR: "🛠️ ซ่อมอุปกรณ์",
  SUPPLY: "📦 ของหมด",
};
const issueStatusLabel: Record<string, string> = {
  OPEN: "รอดำเนินการ",
  IN_PROGRESS: "กำลังแก้ไข",
  RESOLVED: "เสร็จแล้ว",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
      {children}
    </h2>
  );
}

// เทียบกับช่วงก่อนหน้า → ลูกศร ↑↓ + ส่วนต่าง
function DeltaBadge({ cur, prev }: { cur: number; prev: number }) {
  const d = cur - prev;
  if (d === 0)
    return <span className="text-xs text-gray-400">เท่าช่วงก่อน</span>;
  const up = d > 0;
  return (
    <span
      className={`text-xs font-medium ${
        up ? "text-emerald-600" : "text-rose-600"
      }`}
    >
      {up ? "▲" : "▼"} {Math.abs(d)}% จากช่วงก่อน
    </span>
  );
}

// คะแนนประสิทธิภาพ 0–100 → ป้ายสี (เขียว/เหลือง/แดง)
function ScoreBadge({ value }: { value: number }) {
  const cls =
    value >= 80
      ? "bg-emerald-100 text-emerald-800"
      : value >= 60
      ? "bg-amber-100 text-amber-800"
      : "bg-rose-100 text-rose-800";
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}
    >
      {value}
    </span>
  );
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-4 text-center text-gray-400">
        {text}
      </td>
    </tr>
  );
}

export default async function ExecutivePage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    departmentId?: string;
    view?: string;
  }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const fromStr = sp.from || iso(new Date(now.getFullYear(), now.getMonth(), 1));
  // ค่าเริ่มต้น = ทั้งเดือนปัจจุบัน (วันสุดท้ายของเดือน)
  const toStr = sp.to || iso(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const fDept = sp.departmentId || "";
  // แท็บที่เลือก ("" = ภาพรวม)
  const tab = sp.view || "";

  const from = new Date(`${fromStr}T00:00:00`);
  const toDate = new Date(`${toStr}T00:00:00`);
  const queryTo = new Date(toDate);
  queryTo.setDate(queryTo.getDate() + 1); // ให้รวมวันสุดท้าย

  // ช่วงก่อนหน้า (ยาวเท่าช่วงปัจจุบัน) ไว้เทียบแนวโน้ม
  const spanMs = queryTo.getTime() - from.getTime();
  const prevTo = new Date(from.getTime());
  const prevFrom = new Date(from.getTime() - spanMs);
  const days = Math.max(1, Math.round(spanMs / 86400000));

  const me = await currentUser();
  const isAdmin = me?.role === "ADMIN";

  const [report, prevReport, departments, timeRecords] = await Promise.all([
    getExecutiveReport(from, queryTo, fDept || undefined),
    getExecutiveReport(prevFrom, prevTo, fDept || undefined),
    prisma.department.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.workRecord.findMany({
      where: {
        submittedAt: { not: null },
        checkInAt: { gte: from, lt: queryTo },
        ...(fDept ? { checkpoint: { departmentId: fDept } } : {}),
      },
      include: {
        user: true,
        checkpoint: { include: { site: true, department: true } },
        review: true,
      },
      orderBy: { checkInAt: "desc" },
      take: 300,
    }),
  ]);
  const k = report.kpi;
  const pk = prevReport.kpi;
  const deptName = fDept
    ? departments.find((d) => d.id === fDept)?.name ?? ""
    : "";

  return (
    <div className="space-y-4">
      {/* ── หัวรายงาน ── */}
      <div className="rounded-2xl bg-brand-darker text-white p-5 shadow-card">
        <div className="text-xs font-medium text-white/70">
          ระบบตรวจงาน · ผู้บริหาร
        </div>
        <h1 className="text-2xl font-bold mt-0.5">
          {me?.name ?? "รายงานผู้บริหาร"}
        </h1>
        <p className="text-sm text-white/80 mt-1">
          {fmtDate(from)} – {fmtDate(toDate)}
          {deptName ? ` · ฝ่าย ${deptName}` : " · ทุกฝ่าย"}
        </p>
        <p className="text-xs text-white/60 mt-1.5">
          ทีม {report.scope.totalUsers} คน (แม่บ้าน {report.scope.housekeeper} ·
          รปภ. {report.scope.security} · ผู้ตรวจ {report.scope.inspectors}) ·{" "}
          {report.scope.sites} สถานที่ · {report.scope.checkpoints} จุดเช็คอิน
        </p>
      </div>

      {/* ── การ์ดตัวเลขหลัก ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiTile
          label="มาปฏิบัติงาน %"
          value={k.attendanceRate}
          tone="text-emerald-600"
          sub={<DeltaBadge cur={k.attendanceRate} prev={pk.attendanceRate} />}
        />
        <KpiTile
          label="อัตราผ่าน %"
          value={k.passRate}
          tone="text-brand-dark"
          sub={<DeltaBadge cur={k.passRate} prev={pk.passRate} />}
        />
        <KpiTile label="งานทั้งหมด" value={k.total} />
        <KpiTile
          label="ขาดงาน"
          value={k.missed}
          tone={k.missed > 0 ? "text-rose-600" : "text-gray-900"}
          sub={
            <span className="text-xs text-gray-400">รอตรวจ {k.pending}</span>
          }
        />
      </div>

      {/* ── ช่วงเวลา + ฝ่าย ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RangePills
          basePath="/admin/executive"
          from={fromStr}
          to={toStr}
          params={{ view: tab, departmentId: fDept }}
        />
        <ExecutiveDeptFilter
          departments={departments}
          departmentId={fDept}
          view={tab}
          from={fromStr}
          to={toStr}
        />
      </div>

      {isAdmin && (
        <ReportRangeFilter
          from={fromStr}
          to={toStr}
          departmentId={fDept}
          view={tab}
        />
      )}

      {/* ── แท็บ ── */}
      <TabBar
        basePath="/admin/executive"
        paramName="view"
        current={tab}
        tabs={[
          { key: "", label: "ภาพรวม" },
          { key: "checkpoint", label: "รายจุด" },
          { key: "staff", label: "พนักงาน" },
          { key: "inspector", label: "ผู้ตรวจ" },
          { key: "detail", label: "รายละเอียด" },
        ]}
        params={{ from: fromStr, to: toStr, departmentId: fDept }}
      />

      {/* ══ แท็บ: ภาพรวม ══ */}
      {tab === "" && (
        <>
          <section className="space-y-2">
            <SectionTitle>ภาพรวม {days} วัน</SectionTitle>
            <div className="card p-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    {k.total}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">งานทั้งหมด</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-emerald-600">
                    {k.approved}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">ผ่าน</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-rose-600">
                    {k.rejected}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">ไม่ผ่าน</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-600">
                    {k.missed}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">ขาดงาน</div>
                </div>
              </div>
              <div className="mt-5">
                <PassBar value={k.passRate} />
                <p className="text-xs text-gray-400 mt-2">
                  อัตราผ่าน {k.passRate}% จากงานที่ตรวจแล้ว · รอตรวจ {k.pending}{" "}
                  · ยังไม่ได้ตรวจ {k.notReviewed} · ตีกลับให้แก้ {k.returned}
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <SectionTitle>แนวโน้มรายวัน</SectionTitle>
            <DailyTrendChart daily={report.daily} />
          </section>

          <section className="space-y-2">
            <SectionTitle>แยกตามประเภทพนักงาน</SectionTitle>
            <div className="grid sm:grid-cols-2 gap-3">
              {(["HOUSEKEEPER", "SECURITY"] as const).map((t) => {
                const b = report.byStaffType[t];
                return (
                  <div key={t} className="card p-4">
                    <div className="font-semibold mb-2">{typeLabel[t]}</div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>
                        งานทั้งหมด {b.total} · มาปฏิบัติงาน {b.attendanceRate}%
                      </div>
                      <div>
                        ผ่าน {b.approved} · ไม่ผ่าน {b.rejected} · ขาด {b.missed}
                      </div>
                      <PassBar value={b.passRate} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-2">
            <SectionTitle>แจ้งซ่อม / ของหมด</SectionTitle>
            <div className="card p-4 text-sm text-gray-600">
              แจ้งใหม่ในช่วงนี้: ซ่อมอุปกรณ์ {report.issues.repairOpened} · ของหมด{" "}
              {report.issues.supplyOpened} · แก้เสร็จ {report.issues.resolved} ·{" "}
              <span className="text-rose-700 font-medium">
                ค้างอยู่ตอนนี้ {report.issues.openNow}
              </span>
            </div>
          </section>
        </>
      )}

      {/* ══ แท็บ: รายจุด ══ */}
      {tab === "checkpoint" && (
        <>
          <section className="space-y-2">
            <SectionTitle>ผลงานรายจุด (เรียงจุดที่มีปัญหาก่อน)</SectionTitle>
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="p-3 font-medium">จุด / สถานที่</th>
                    <th className="p-3 font-medium">ผู้ตรวจจริง</th>
                    <th className="p-3 font-medium text-center">งาน</th>
                    <th className="p-3 font-medium text-center">ผ่าน</th>
                    <th className="p-3 font-medium text-center">ไม่ผ่าน</th>
                    <th className="p-3 font-medium text-center">ขาด</th>
                    <th className="p-3 font-medium w-40">อัตราผ่าน</th>
                    <th className="p-3 font-medium text-center">คะแนน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {report.byCheckpoint.length === 0 && (
                    <EmptyRow colSpan={8} text="ไม่มีข้อมูลในช่วงนี้" />
                  )}
                  {report.byCheckpoint.map((c) => (
                    <tr key={`${c.name}-${c.site}`} className="hover:bg-gray-50">
                      <td className="p-3">
                        <div className="text-gray-800">{c.name}</div>
                        <div className="text-xs text-gray-400">{c.site}</div>
                      </td>
                      <td className="p-3 text-gray-600 whitespace-nowrap">
                        {c.inspectors.length ? c.inspectors.join(", ") : "—"}
                      </td>
                      <td className="p-3 text-center">{c.total}</td>
                      <td className="p-3 text-center text-emerald-700">
                        {c.approved}
                      </td>
                      <td className="p-3 text-center text-rose-700">
                        {c.rejected}
                      </td>
                      <td className="p-3 text-center text-amber-700">
                        {c.missed}
                      </td>
                      <td className="p-3">
                        <PassBar value={c.passRate} />
                      </td>
                      <td className="p-3 text-center">
                        <ScoreBadge value={c.score} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-2">
            <SectionTitle>แยกตามสถานที่</SectionTitle>
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="p-3 font-medium">สถานที่</th>
                    <th className="p-3 font-medium text-center">งาน</th>
                    <th className="p-3 font-medium text-center">ขาด</th>
                    <th className="p-3 font-medium w-40">อัตราผ่าน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {report.bySite.length === 0 && (
                    <EmptyRow colSpan={4} text="ไม่มีข้อมูลในช่วงนี้" />
                  )}
                  {report.bySite.map((s) => (
                    <tr key={s.name} className="hover:bg-gray-50">
                      <td className="p-3 text-gray-800">{s.name}</td>
                      <td className="p-3 text-center">{s.total}</td>
                      <td className="p-3 text-center">{s.missed}</td>
                      <td className="p-3">
                        <PassBar value={s.passRate} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* ══ แท็บ: พนักงาน ══ */}
      {tab === "staff" && (
        <>
          <section className="space-y-2">
            <SectionTitle>อัตราผ่าน รายคน</SectionTitle>
            <div className="card p-4 space-y-3.5">
              {report.staffRanking.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-2">
                  ไม่มีข้อมูลในช่วงนี้
                </p>
              )}
              {report.staffRanking.map((u) => (
                <div key={u.name} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-gray-800 truncate">
                      {u.name}
                      {u.staffType && (
                        <span className="text-xs text-gray-400">
                          {" "}
                          · {typeLabel[u.staffType]}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      ผ่าน {u.approved} / {u.total} งาน
                    </span>
                  </div>
                  <PassBar value={u.passRate} />
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <SectionTitle>จัดอันดับพนักงาน</SectionTitle>
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="p-3 font-medium">#</th>
                    <th className="p-3 font-medium">พนักงาน</th>
                    <th className="p-3 font-medium text-center">งาน</th>
                    <th className="p-3 font-medium text-center">มางาน%</th>
                    <th className="p-3 font-medium text-center">ตรงเวลา%</th>
                    <th className="p-3 font-medium w-40">อัตราผ่าน</th>
                    <th className="p-3 font-medium text-center">คะแนน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {report.staffRanking.length === 0 && (
                    <EmptyRow colSpan={7} text="ไม่มีข้อมูลในช่วงนี้" />
                  )}
                  {report.staffRanking.map((u, i) => (
                    <tr key={u.name} className="hover:bg-gray-50">
                      <td className="p-3 text-gray-500">{i + 1}</td>
                      <td className="p-3 text-gray-800">
                        {u.name}
                        {u.staffType && (
                          <span className="text-xs text-gray-400">
                            {" "}
                            · {typeLabel[u.staffType]}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">{u.total}</td>
                      <td className="p-3 text-center">{u.attendanceRate}%</td>
                      <td className="p-3 text-center">
                        {u.onTimeRate == null ? "—" : `${u.onTimeRate}%`}
                      </td>
                      <td className="p-3">
                        <PassBar value={u.passRate} />
                      </td>
                      <td className="p-3 text-center">
                        <ScoreBadge value={u.score} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* ══ แท็บ: ผู้ตรวจ ══ */}
      {tab === "inspector" && (
        <section className="space-y-2">
          <SectionTitle>สรุปผู้ตรวจ (ในช่วงนี้)</SectionTitle>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="p-3 font-medium">#</th>
                  <th className="p-3 font-medium">ผู้ตรวจ</th>
                  <th className="p-3 font-medium text-center">จำนวนที่ตรวจ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {report.inspectors.length === 0 && (
                  <EmptyRow colSpan={3} text="ยังไม่มีการตรวจในช่วงนี้" />
                )}
                {report.inspectors.map((ins, i) => (
                  <tr key={ins.name} className="hover:bg-gray-50">
                    <td className="p-3 text-gray-500">{i + 1}</td>
                    <td className="p-3 text-gray-800">{ins.name}</td>
                    <td className="p-3 text-center">{ins.reviewed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ══ แท็บ: รายละเอียด ══ */}
      {tab === "detail" && (
        <>
          <section className="space-y-2">
            <SectionTitle>งานล่าสุด</SectionTitle>
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="p-3 font-medium">พนักงาน</th>
                    <th className="p-3 font-medium">จุด / สถานที่</th>
                    <th className="p-3 font-medium whitespace-nowrap">เช็คอิน</th>
                    <th className="p-3 font-medium">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {report.recentWork.length === 0 && (
                    <EmptyRow colSpan={4} text="ไม่มีข้อมูลในช่วงนี้" />
                  )}
                  {report.recentWork.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="p-3 text-gray-800 whitespace-nowrap">
                        {r.staff}
                      </td>
                      <td className="p-3 text-gray-600">
                        <div className="text-gray-800">{r.checkpoint}</div>
                        <div className="text-xs text-gray-400">{r.site}</div>
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
          </section>

          <section className="space-y-2">
            <SectionTitle>รายการแจ้งซ่อม / ของหมดล่าสุด</SectionTitle>
            <div className="card divide-y divide-gray-100">
              {report.recentIssues.length === 0 && (
                <div className="p-4 text-center text-gray-400 text-sm">
                  ไม่มีการแจ้งในช่วงนี้
                </div>
              )}
              {report.recentIssues.map((it, i) => (
                <div key={i} className="p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-gray-800">
                      {issueTypeLabel[it.type] ?? it.type}
                    </span>
                    <span className="text-xs text-gray-400">
                      {fmtDateTime(it.createdAt)} ·{" "}
                      {issueStatusLabel[it.status] ?? it.status}
                    </span>
                  </div>
                  <div className="text-gray-500 text-xs mt-0.5">
                    {it.site} · {it.checkpoint}
                  </div>
                  <div className="text-gray-700 mt-0.5">{it.detail}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <SectionTitle>รายงานเวลาการทำงาน (รายครั้ง)</SectionTitle>
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="p-3 font-medium">พนักงาน</th>
                    <th className="p-3 font-medium">สถานที่ / จุด</th>
                    <th className="p-3 font-medium whitespace-nowrap">เข้า</th>
                    <th className="p-3 font-medium whitespace-nowrap">ส่งงาน</th>
                    <th className="p-3 font-medium whitespace-nowrap">
                      เวลาที่ใช้
                    </th>
                    <th className="p-3 font-medium">ผล</th>
                    <th className="p-3 font-medium text-right">รายละเอียด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {timeRecords.length === 0 && (
                    <EmptyRow colSpan={7} text="ไม่มีข้อมูลในช่วงนี้" />
                  )}
                  {timeRecords.map((r) => (
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
                      <td className="p-3 text-gray-600 whitespace-nowrap">
                        {r.submittedAt ? fmtDateTime(r.submittedAt) : "—"}
                      </td>
                      <td className="p-3 font-semibold text-brand-dark whitespace-nowrap">
                        {fmtDuration(r.checkInAt, r.submittedAt)}
                      </td>
                      <td className="p-3">
                        <StatusBadge status={r.status} />
                        {lateInfo(r.lateMinutes).late && (
                          <div className="mt-1">
                            <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-800 whitespace-nowrap">
                              ⏰ สาย {r.lateMinutes} น.
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <ReportDetailButton record={r} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400">
              แสดงสูงสุด 300 รายการ · งานที่ยังไม่ส่ง (กำลังทำงาน)
              จะไม่อยู่ในรายงานนี้
            </p>
          </section>
        </>
      )}
    </div>
  );
}
