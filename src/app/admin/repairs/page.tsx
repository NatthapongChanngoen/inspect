import Link from "next/link";
import { getRepairReport } from "@/lib/repairReport";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { fmtDate, fmtDateTime } from "@/lib/date";
import ImageThumb from "@/components/ImageThumb";
import RepairDashboardFilter from "@/components/RepairDashboardFilter";
import RepairDoneCheckpointFilter from "@/components/RepairDoneCheckpointFilter";
import TabBar from "@/components/TabBar";
import RangePills from "@/components/RangePills";
import KpiTile from "@/components/KpiTile";
import PassBar from "@/components/PassBar";
import RepairTrendChart from "@/components/RepairTrendChart";

export const dynamic = "force-dynamic";

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
      {children}
    </h2>
  );
}

const baht = (n: number) => `${n.toLocaleString("th-TH")} ฿`;

// เวลาเฉลี่ยที่ใช้ซ่อม (นาที) → ข้อความอ่านง่าย (นาที/ชม/วัน)
function fmtMins(mins: number | null): string {
  if (mins == null) return "—";
  if (mins < 60) return `${mins} นาที`;
  const h = Math.round(mins / 60);
  if (h < 48) return `${h} ชม`;
  return `${Math.round(h / 24)} วัน`;
}

// สรุป "ของหมด" ตามขั้นตอน: รอฝ่ายรับเรื่อง → กำลังเติม → เติมแล้ว
function SupplyFlowSummary({
  supply,
}: {
  supply: { newCount: number; openNow: number; inProgressNow: number; resolved: number };
}) {
  const steps = [
    {
      label: "รอฝ่ายรับเรื่อง",
      value: supply.openNow,
      tone: "text-rose-600",
      hint: "ค้างอยู่ตอนนี้",
    },
    {
      label: "รับเรื่องแล้ว · กำลังเติม",
      value: supply.inProgressNow,
      tone: "text-amber-600",
      hint: "ค้างอยู่ตอนนี้",
    },
    {
      label: "เติมแล้ว",
      value: supply.resolved,
      tone: "text-emerald-600",
      hint: "ในช่วงนี้",
    },
  ];
  return (
    <div className="card p-5">
      <div className="grid grid-cols-3 gap-3 text-center">
        {steps.map((s, i) => (
          <div key={s.label} className="relative">
            {i > 0 && (
              <span className="absolute -left-2 top-3 text-gray-300 select-none">
                →
              </span>
            )}
            <div className={`text-2xl font-bold ${s.tone}`}>{s.value}</div>
            <div className="text-xs text-gray-600 mt-0.5">{s.label}</div>
            <div className="text-[10px] text-gray-400">{s.hint}</div>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-4">
        แจ้งของหมดใหม่ในช่วงนี้ {supply.newCount} รายการ
      </p>
    </div>
  );
}

export default async function RepairsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    departmentId?: string;
    type?: string;
    cp?: string;
  }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const fromStr = sp.from || iso(new Date(now.getFullYear(), now.getMonth(), 1));
  const toStr = sp.to || iso(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const fDept = sp.departmentId || "";
  const fCp = sp.cp || "";
  // แท็บ = ตัวกรองเรื่องในตัว ("" = ภาพรวม · REPAIR = งานซ่อม · SUPPLY = ของหมด)
  const fType = sp.type === "REPAIR" || sp.type === "SUPPLY" ? sp.type : "";
  const isSupplyTab = fType === "SUPPLY";

  const from = new Date(`${fromStr}T00:00:00`);
  const toDate = new Date(`${toStr}T00:00:00`);
  const to = new Date(toDate);
  to.setDate(to.getDate() + 1); // รวมวันสุดท้าย
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000));

  const me = await currentUser();
  const isAdmin = me?.role === "ADMIN";
  const isExec = me?.role === "EXECUTIVE";

  const [report, departments, checkpointOpts] = await Promise.all([
    getRepairReport(from, to, {
      departmentId: fDept || undefined,
      type: fType || undefined,
      checkpointId: fCp || undefined,
    }),
    prisma.department.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    // รายชื่อจุดสำหรับตัวกรอง section งานซ่อมที่เสร็จ (กรองตามฝ่ายถ้าเลือก)
    prisma.checkpoint.findMany({
      where: { active: true, ...(fDept ? { departmentId: fDept } : {}) },
      orderBy: { name: "asc" },
      select: { id: true, name: true, site: { select: { name: true } } },
    }),
  ]);

  const { backlog, period, byDepartment, proposedList, doneRepairs, supply } =
    report;
  const deptName = fDept
    ? departments.find((d) => d.id === fDept)?.name ?? ""
    : "";
  const maxDeptNew = Math.max(1, ...byDepartment.map((d) => d.newCount));

  return (
    <div className="space-y-4">
      {/* ── หัวแดชบอร์ด ── */}
      <div className="rounded-2xl bg-brand-darker text-white p-5 shadow-card">
        <div className="text-xs font-medium text-white/70">
          ระบบตรวจงาน · แดชบอร์ด
        </div>
        <h1 className="text-2xl font-bold mt-0.5">แดชบอร์ดงานซ่อม / ของหมด</h1>
        <p className="text-sm text-white/80 mt-1">
          {fmtDate(from)} – {fmtDate(toDate)}
          {deptName ? ` · ฝ่าย ${deptName}` : " · ทุกฝ่าย"}
        </p>
      </div>

      {/* ── การ์ดตัวเลขหลัก (เปลี่ยนตามแท็บ) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {isSupplyTab ? (
          <>
            <KpiTile
              label="รอฝ่ายรับเรื่อง"
              value={supply.openNow}
              tone={supply.openNow > 0 ? "text-rose-600" : "text-gray-900"}
              href={isAdmin ? "/admin/issues?status=OPEN" : undefined}
            />
            <KpiTile
              label="รับเรื่องแล้ว · กำลังเติม"
              value={supply.inProgressNow}
              tone={supply.inProgressNow > 0 ? "text-amber-600" : "text-gray-900"}
            />
            <KpiTile
              label="เติมแล้ว (ในช่วงนี้)"
              value={supply.resolved}
              tone="text-emerald-600"
            />
            <KpiTile label="แจ้งใหม่ (ในช่วงนี้)" value={supply.newCount} />
          </>
        ) : (
          <>
            <KpiTile
              label="รอดำเนินการ"
              value={backlog.open}
              tone={backlog.open > 0 ? "text-rose-600" : "text-gray-900"}
              href={isAdmin ? "/admin/issues?status=OPEN" : undefined}
            />
            <KpiTile
              label="รอผู้บริหารเลือกข้อเสนอ"
              value={backlog.proposed}
              tone={backlog.proposed > 0 ? "text-amber-600" : "text-gray-900"}
              // ส่งฝ่ายที่กรองอยู่ไปด้วย ไม่งั้นคลิกแล้วตัวกรองหลุด = เลขไม่ตรงกับที่เพิ่งคลิก
              href={
                isExec
                  ? `/issues${fDept ? `?departmentId=${fDept}` : ""}`
                  : isAdmin
                    ? "/admin/issues?status=PROPOSED"
                    : undefined
              }
            />
            <KpiTile
              label="รอช่างปิดงาน"
              value={backlog.inRepair}
              tone={backlog.inRepair > 0 ? "text-brand-dark" : "text-gray-900"}
            />
            <KpiTile
              label="ค่าใช้จ่ายรวม"
              value={baht(period.spendTotal)}
              tone="text-orange-600"
              sub={
                <span className="text-xs text-gray-400">
                  {period.spendCount} งาน · เฉลี่ย {baht(period.spendAvg)}/งาน
                </span>
              }
            />
          </>
        )}
      </div>

      {/* ── ช่วงเวลา + ตัวกรอง ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RangePills
          basePath="/admin/repairs"
          from={fromStr}
          to={toStr}
          params={{ departmentId: fDept, type: fType, cp: fCp }}
        />
        <RepairDashboardFilter
          departments={departments}
          departmentId={fDept}
          type={fType}
          from={fromStr}
          to={toStr}
        />
      </div>

      {/* ── แท็บ (คุมตัวกรองเรื่องในตัว) ── */}
      <TabBar
        basePath="/admin/repairs"
        paramName="type"
        current={fType}
        tabs={[
          { key: "", label: "ภาพรวม" },
          { key: "REPAIR", label: "งานซ่อม" },
          { key: "SUPPLY", label: "ของหมด" },
        ]}
        params={{ from: fromStr, to: toStr, departmentId: fDept }}
      />

      {/* ══ แท็บ: ภาพรวม ══ */}
      {fType === "" && (
        <>
          <section className="space-y-2">
            <SectionTitle>ภาพรวม {days} วัน</SectionTitle>
            <div className="card p-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    {period.newTotal}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">แจ้งใหม่</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-emerald-600">
                    {period.resolved}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">ปิดงานเสร็จ</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600">
                    {period.spendTotal.toLocaleString("th-TH")}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">ค่าใช้จ่าย (฿)</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-brand-dark">
                    {fmtMins(period.avgResolveMinutes)}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    เวลาเฉลี่ยที่ใช้ซ่อม
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-4">
                แจ้งใหม่ในช่วงนี้: ซ่อม {period.newRepair} · ของหมด{" "}
                {period.newSupply} · ค้างอยู่ตอนนี้ {backlog.open} รอดำเนินการ ·{" "}
                {backlog.proposed} รอเลือกข้อเสนอ · {backlog.inRepair} รอปิดงาน
              </p>
            </div>
          </section>

          <section className="space-y-2">
            <SectionTitle>แนวโน้มรายวัน</SectionTitle>
            <RepairTrendChart daily={report.daily} />
          </section>

          <section className="space-y-2">
            <SectionTitle>สรุปการแจ้งของหมด</SectionTitle>
            <SupplyFlowSummary supply={supply} />
          </section>

          <section className="space-y-2">
            <SectionTitle>แยกตามฝ่าย (ในช่วงนี้)</SectionTitle>
            <div className="card p-4 space-y-3.5">
              {byDepartment.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-2">
                  ไม่มีข้อมูลในช่วงนี้
                </p>
              )}
              {byDepartment.map((d) => (
                <div key={d.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-gray-800 truncate">{d.name}</span>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      แจ้ง {d.newCount} · เสร็จ {d.resolved}
                      {d.spend > 0 ? ` · ${baht(d.spend)}` : ""}
                    </span>
                  </div>
                  <PassBar
                    value={Math.round((d.newCount / maxDeptNew) * 100)}
                    showLabel={false}
                  />
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* ══ แท็บ: งานซ่อม ══ */}
      {fType === "REPAIR" && (
        <>
          <section className="space-y-2">
            <SectionTitle>
              รอผู้บริหารเลือกข้อเสนอ ({proposedList.length})
            </SectionTitle>
            {proposedList.length === 0 ? (
              <div className="card p-6 text-center text-gray-400 text-sm">
                ✓ ไม่มีงานที่รอเลือกข้อเสนอ
              </div>
            ) : (
              <div className="space-y-2">
                {proposedList.map((it) => {
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
                                ? baht(min)
                                : `${min.toLocaleString(
                                    "th-TH"
                                  )}–${max!.toLocaleString("th-TH")} ฿`}
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <SectionTitle>งานซ่อมที่เสร็จแล้ว (รูปก่อน/หลัง)</SectionTitle>
            <RepairDoneCheckpointFilter
              checkpoints={checkpointOpts.map((c) => ({
                id: c.id,
                name: c.name,
                site: c.site.name,
              }))}
              checkpointId={fCp}
              from={fromStr}
              to={toStr}
              departmentId={fDept}
              type={fType}
            />
            {doneRepairs.length === 0 ? (
              <div className="card p-4 text-sm text-gray-400 text-center">
                ไม่มีงานซ่อมที่เสร็จในช่วงนี้
              </div>
            ) : (
              <div className="space-y-3">
                {doneRepairs.map((it) => {
                  const sel = it.proposals[0];
                  return (
                    <div key={it.id} className="card p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <div className="font-medium text-gray-800">
                            {it.checkpoint.name}
                          </div>
                          <div className="text-xs text-gray-400">
                            {it.checkpoint.department
                              ? `${it.checkpoint.department.name} · `
                              : ""}
                            {it.checkpoint.site.name}
                          </div>
                        </div>
                        <span className="text-xs text-gray-400">
                          เสร็จ {it.resolvedAt ? fmtDateTime(it.resolvedAt) : "-"}
                        </span>
                      </div>
                      <div className="text-sm text-gray-700 whitespace-pre-wrap">
                        {it.detail}
                      </div>
                      {sel && (
                        <div className="text-xs text-gray-500">
                          ช่าง {sel.technician} · ราคา {baht(sel.price)}
                          {it.resolvedBy ? ` · ปิดโดย ${it.resolvedBy.name}` : ""}
                          {sel.detail ? ` · ${sel.detail}` : ""}
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs font-medium text-gray-500 mb-1">
                            ก่อนซ่อม (ตอนแจ้ง)
                          </div>
                          {it.photoPath ? (
                            <ImageThumb
                              src={`/api/files/${it.photoPath}`}
                              alt="ก่อนซ่อม"
                            />
                          ) : (
                            <p className="text-xs text-gray-400">ไม่มีรูป</p>
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-medium text-gray-500 mb-1">
                            หลังซ่อม (หลักฐาน)
                          </div>
                          {it.completionPhotoPath ? (
                            <ImageThumb
                              src={`/api/files/${it.completionPhotoPath}`}
                              alt="หลังซ่อม"
                            />
                          ) : (
                            <p className="text-xs text-gray-400">ไม่มีรูป</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {/* ══ แท็บ: ของหมด ══ */}
      {isSupplyTab && (
        <>
          <section className="space-y-2">
            <SectionTitle>ขั้นตอนการแจ้งของหมด</SectionTitle>
            <SupplyFlowSummary supply={supply} />
          </section>

          <section className="space-y-2">
            <SectionTitle>แนวโน้มรายวัน (ของหมด)</SectionTitle>
            <RepairTrendChart daily={report.daily} />
          </section>

          <section className="space-y-2">
            <SectionTitle>
              รายการของหมดล่าสุด ({supply.list.length})
            </SectionTitle>
            {supply.list.length === 0 ? (
              <div className="card p-6 text-center text-gray-400 text-sm">
                ไม่มีการแจ้งของหมดในช่วงนี้
              </div>
            ) : (
              <div className="space-y-3">
                {supply.list.map((it) => {
                  const status =
                    it.status === "RESOLVED"
                      ? { label: "✅ เติมแล้ว", cls: "bg-emerald-100 text-emerald-800" }
                      : it.status === "IN_PROGRESS"
                      ? { label: "🔧 กำลังเติม", cls: "bg-amber-100 text-amber-800" }
                      : { label: "⏳ รอฝ่ายรับเรื่อง", cls: "bg-rose-100 text-rose-800" };
                  return (
                    <Link
                      key={it.id}
                      href={`/issues/${it.id}`}
                      className="card p-4 block space-y-2 hover:bg-gray-50"
                    >
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="min-w-0">
                          <div className="font-medium text-gray-800 truncate">
                            📦 {it.checkpoint.name}
                          </div>
                          <div className="text-xs text-gray-400">
                            {it.checkpoint.department
                              ? `${it.checkpoint.department.name} · `
                              : ""}
                            {it.checkpoint.site.name}
                          </div>
                        </div>
                        <span className={`badge ${status.cls}`}>
                          {status.label}
                        </span>
                      </div>

                      <div className="text-sm text-gray-700 whitespace-pre-wrap">
                        {it.detail}
                      </div>

                      <div className="text-xs text-gray-500 space-y-0.5">
                        <div>แจ้งเมื่อ {fmtDateTime(it.createdAt)}</div>
                        {it.acceptedBy && (
                          <div>
                            รับเรื่องโดย {it.acceptedBy.name}
                            {it.acceptedAt
                              ? ` · ${fmtDateTime(it.acceptedAt)}`
                              : ""}
                          </div>
                        )}
                        {it.resolvedBy && (
                          <div className="text-emerald-700">
                            เติมโดย {it.resolvedBy.name}
                            {it.resolvedAt
                              ? ` · ${fmtDateTime(it.resolvedAt)}`
                              : ""}
                          </div>
                        )}
                      </div>

                      {(it.photoPath || it.completionPhotoPath) && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-xs font-medium text-gray-500 mb-1">
                              ตอนแจ้ง
                            </div>
                            {it.photoPath ? (
                              <ImageThumb
                                src={`/api/files/${it.photoPath}`}
                                alt="ตอนแจ้งของหมด"
                              />
                            ) : (
                              <p className="text-xs text-gray-400">ไม่มีรูป</p>
                            )}
                          </div>
                          <div>
                            <div className="text-xs font-medium text-gray-500 mb-1">
                              หลักฐานว่าเติมแล้ว
                            </div>
                            {it.completionPhotoPath ? (
                              <ImageThumb
                                src={`/api/files/${it.completionPhotoPath}`}
                                alt="เติมแล้ว"
                              />
                            ) : (
                              <p className="text-xs text-gray-400">ยังไม่มีรูป</p>
                            )}
                          </div>
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
