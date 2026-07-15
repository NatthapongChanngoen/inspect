"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { DOW_SHORT, fmtDaysOfWeek } from "@/lib/date";
import { createSchedulesBatch, deleteSchedule } from "@/app/admin/actions";
import { checkpointLabel } from "@/lib/checkpoint";
import TimeSelect24 from "./TimeSelect24";

const TH_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

type Staff = { id: string; name: string; staffType: string | null };
type Checkpoint = {
  id: string;
  name: string;
  site: { name: string };
  department?: { name: string } | null;
};

const staffTypeLabel: Record<string, string> = {
  HOUSEKEEPER: "แม่บ้าน",
  SECURITY: "รปภ.",
};

const reviewPolicyLabel: Record<string, string> = {
  REMOTE: "ตรวจระยะไกล",
  ON_SITE: "ตรวจที่จุด",
  BOTH: "ตรวจได้ทั้งสองแบบ",
};

type Item = {
  userId: string;
  checkpointId: string;
  daysOfWeek: number[];
  startTime: string;
  note: string;
  reviewPolicy: string;
  userName: string;
  checkpointLabel: string;
};

type ScheduleRow = {
  id: string;
  checkpointId: string;
  daysOfWeek: number[];
  startTime: string | null;
  note: string | null;
  active: boolean;
  reviewPolicy: string;
  user: { name: string; staffType: string | null };
  checkpoint: {
    name: string;
    site: { name: string };
    department: { name: string } | null;
  };
};

const listSelectCls =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

function presetDays(preset: string, custom: number[]): number[] {
  if (preset === "daily") return [0, 1, 2, 3, 4, 5, 6];
  if (preset === "weekdays") return [1, 2, 3, 4, 5];
  if (preset === "weekends") return [0, 6];
  return custom;
}

export default function BatchScheduleForm({
  staff,
  checkpoints,
  schedules,
}: {
  staff: Staff[];
  checkpoints: Checkpoint[];
  schedules: ScheduleRow[];
}) {
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState<"" | "HOUSEKEEPER" | "SECURITY">("");
  const shown = typeFilter
    ? staff.filter((s) => s.staffType === typeFilter)
    : staff;
  const [listQuery, setListQuery] = useState("");
  const [fCp, setFCp] = useState("");
  const q = listQuery.trim().toLowerCase();
  const shownSchedules = schedules.filter((s) => {
    if (typeFilter && s.user.staffType !== typeFilter) return false;
    if (fCp && s.checkpointId !== fCp) return false;
    if (!q) return true;
    const hay = `${s.user.name} ${s.checkpoint.name} ${s.checkpoint.site.name} ${
      s.checkpoint.department?.name ?? ""
    }`.toLowerCase();
    return hay.includes(q);
  });
  const [userId, setUserId] = useState(staff[0]?.id ?? "");
  const [checkpointId, setCheckpointId] = useState(checkpoints[0]?.id ?? "");
  const [preset, setPreset] = useState("weekdays");

  function onTypeChange(v: "" | "HOUSEKEEPER" | "SECURITY") {
    setTypeFilter(v);
    const next = v ? staff.filter((s) => s.staffType === v) : staff;
    setUserId(next[0]?.id ?? "");
  }
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState("");
  const [note, setNote] = useState("");
  const [reviewPolicy, setReviewPolicy] = useState("BOTH");

  const now = new Date();
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });

  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const isCustom = preset === "custom";

  function toggleDow(w: number) {
    setCustomDays((cur) =>
      cur.includes(w) ? cur.filter((x) => x !== w) : [...cur, w]
    );
  }
  function shiftMonth(delta: number) {
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  function addItem() {
    setError("");
    const days = presetDays(preset, customDays);
    if (!userId || !checkpointId) {
      setError("กรุณาเลือกพนักงานและจุด");
      return;
    }
    if (days.length === 0) {
      setError("กรุณาเลือกวันอย่างน้อย 1 วัน");
      return;
    }
    const u = staff.find((s) => s.id === userId);
    const c = checkpoints.find((c) => c.id === checkpointId);
    setItems((cur) => [
      ...cur,
      {
        userId,
        checkpointId,
        daysOfWeek: days,
        startTime,
        note,
        reviewPolicy,
        userName: u?.name ?? "",
        checkpointLabel: c ? checkpointLabel(c) : "",
      },
    ]);
    setNote("");
  }

  function removeItem(i: number) {
    setItems((cur) => cur.filter((_, idx) => idx !== i));
  }

  function saveAll() {
    if (items.length === 0) {
      setError("ยังไม่มีงานในรายการ — กด “เพิ่มลงรายการ” ก่อน");
      return;
    }
    setError("");
    startTransition(async () => {
      const res = await createSchedulesBatch(
        items.map((it) => ({
          userId: it.userId,
          checkpointId: it.checkpointId,
          daysOfWeek: it.daysOfWeek,
          startTime: it.startTime || null,
          note: it.note || null,
          reviewPolicy: it.reviewPolicy || "BOTH",
        }))
      );
      if (!res.ok) {
        setError(res.error || "บันทึกไม่สำเร็จ");
        return;
      }
      setItems([]);
      router.refresh();
    });
  }

  // ช่องปฏิทินสำหรับเลือกวัน (กรณีกำหนดเอง)
  const firstDow = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="space-y-3">
      <div className="card p-4 space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">ประเภทพนักงาน</label>
            <select
              className="input"
              value={typeFilter}
              onChange={(e) =>
                onTypeChange(e.target.value as "" | "HOUSEKEEPER" | "SECURITY")
              }
            >
              <option value="">ทุกประเภท</option>
              <option value="HOUSEKEEPER">แม่บ้าน</option>
              <option value="SECURITY">รปภ.</option>
            </select>
          </div>
          <div>
            <label className="label">พนักงาน</label>
            <select
              className="input"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              {shown.length === 0 && (
                <option value="" disabled>
                  — ไม่มีพนักงานประเภทนี้ —
                </option>
              )}
              {shown.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.staffType ? ` · ${staffTypeLabel[u.staffType] ?? ""}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">จุดเช็คอิน</label>
            <select
              className="input"
              value={checkpointId}
              onChange={(e) => setCheckpointId(e.target.value)}
            >
              {checkpoints.map((c) => (
                <option key={c.id} value={c.id}>
                  {checkpointLabel(c)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">เวลาเริ่ม</label>
            <TimeSelect24 value={startTime} onChange={setStartTime} />
          </div>
          <div>
            <label className="label">วิธีตรวจ</label>
            <select
              className="input"
              value={reviewPolicy}
              onChange={(e) => setReviewPolicy(e.target.value)}
            >
              <option value="BOTH">ตรวจได้ทั้งสองแบบ</option>
              <option value="REMOTE">ตรวจระยะไกลอย่างเดียว</option>
              <option value="ON_SITE">ตรวจที่จุดอย่างเดียว</option>
            </select>
          </div>
          <div>
            <label className="label">หมายเหตุ</label>
            <input
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label">รูปแบบ</label>
          <select
            className="input"
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
          >
            <option value="daily">ทุกวัน</option>
            <option value="weekdays">จันทร์-ศุกร์</option>
            <option value="weekends">เสาร์-อาทิตย์</option>
            <option value="custom">กำหนดเอง (เลือกวันจากปฏิทิน)</option>
          </select>
        </div>

        {isCustom && (
          <div>
            <label className="label">
              เลือกวัน (คลิกวันในปฏิทิน = ทำซ้ำทุกวันนั้นของสัปดาห์)
            </label>
            <div className="rounded-xl border border-gray-200 p-3 select-none max-w-sm">
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-600"
                >
                  ‹
                </button>
                <div className="font-semibold text-gray-800">
                  {TH_MONTHS[view.m]} {view.y + 543}
                </div>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-600"
                >
                  ›
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {DOW_SHORT.map((d, w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => toggleDow(w)}
                    className={`text-xs font-semibold py-1 rounded ${
                      customDays.includes(w) ? "text-brand-dark" : "text-gray-400"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map((d, i) => {
                  if (d === null) return <div key={i} />;
                  const w = new Date(view.y, view.m, d).getDay();
                  const active = customDays.includes(w);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleDow(w)}
                      className={`aspect-square rounded-lg text-sm transition-colors ${
                        active
                          ? "bg-brand text-white font-semibold"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <button type="button" className="btn-ghost" onClick={addItem}>
          ＋ เพิ่มลงรายการ
        </button>
      </div>

      {items.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="p-3 font-medium">พนักงาน</th>
                <th className="p-3 font-medium">สถานที่ / จุด</th>
                <th className="p-3 font-medium whitespace-nowrap">วัน</th>
                <th className="p-3 font-medium whitespace-nowrap">เวลา</th>
                <th className="p-3 font-medium">หมายเหตุ</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((it, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="p-3 font-medium text-gray-800 whitespace-nowrap">
                    {it.userName}
                  </td>
                  <td className="p-3 text-gray-600">{it.checkpointLabel}</td>
                  <td className="p-3 text-gray-600 whitespace-nowrap">
                    {fmtDaysOfWeek(it.daysOfWeek)}
                  </td>
                  <td className="p-3 text-gray-600 whitespace-nowrap">
                    {it.startTime || "—"}
                  </td>
                  <td className="p-3 text-gray-600">{it.note || "—"}</td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      className="text-red-600 text-sm"
                      onClick={() => removeItem(i)}
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>
      )}

      <button
        type="button"
        className="btn-primary"
        onClick={saveAll}
        disabled={pending || items.length === 0}
      >
        {pending
          ? "กำลังบันทึก…"
          : `บันทึกทั้งหมด${items.length > 0 ? ` (${items.length} งาน)` : ""}`}
      </button>

      {/* รายการงานประจำที่มีอยู่ (กรองตามประเภทที่เลือก) */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={listQuery}
            onChange={(e) => setListQuery(e.target.value)}
            placeholder="ค้นหา ชื่อพนักงาน / จุด / สถานที่"
            className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
        <select
          value={fCp}
          onChange={(e) => setFCp(e.target.value)}
          className={listSelectCls}
        >
          <option value="">ทุกสถานที่ / จุด</option>
          {checkpoints.map((c) => (
            <option key={c.id} value={c.id}>
              {checkpointLabel(c)}
            </option>
          ))}
        </select>
      </div>
      <div className="card divide-y">
        {shownSchedules.length === 0 && (
          <div className="p-4 text-center text-gray-500 text-sm">
            {typeFilter ? "ไม่มีงานประจำของประเภทนี้" : "ยังไม่มีงานประจำ"}
          </div>
        )}
        {shownSchedules.map((s) => (
          <div key={s.id} className="p-3 flex items-center justify-between gap-2">
            <div>
              <div className="font-medium">
                {s.user.name} → {s.checkpoint.name}
                {!s.active && (
                  <span className="badge bg-gray-200 text-gray-600 ml-2">ปิด</span>
                )}
              </div>
              <div className="text-sm text-gray-500">
                {s.checkpoint.department
                  ? `${s.checkpoint.department.name} · `
                  : ""}
                {s.checkpoint.site.name} ·{" "}
                <span className="font-medium text-brand-dark">
                  {fmtDaysOfWeek(s.daysOfWeek)}
                </span>
                {s.startTime ? ` · ${s.startTime} น.` : ""}
                {` · ${reviewPolicyLabel[s.reviewPolicy] ?? s.reviewPolicy}`}
                {s.note ? ` · ${s.note}` : ""}
              </div>
            </div>
            <form action={deleteSchedule}>
              <input type="hidden" name="id" value={s.id} />
              <button className="text-red-600 text-sm">ลบ</button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
