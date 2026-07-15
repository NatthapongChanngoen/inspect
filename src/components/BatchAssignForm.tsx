"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { createAssignmentsBatch, deleteAssignment } from "@/app/admin/actions";
import { checkpointLabel } from "@/lib/checkpoint";
import { fmtDate } from "@/lib/date";
import TimeSelect24 from "./TimeSelect24";

type Staff = { id: string; name: string; staffType: string | null };
type Insp = { id: string; name: string };
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
  date: string;
  startTime: string;
  note: string;
  inspectorId: string;
  inspectorId2: string;
  reviewPolicy: string;
  // ป้ายไว้แสดงในตาราง
  userName: string;
  checkpointLabel: string;
  inspectorName: string;
  inspectorName2: string;
};

type AssignmentRow = {
  id: string;
  checkpointId: string;
  scheduledDate: Date | string;
  startTime: string | null;
  note: string | null;
  reviewPolicy: string;
  user: { name: string; staffType: string | null };
  inspector: { name: string } | null;
  inspector2: { name: string } | null;
  checkpoint: {
    name: string;
    site: { name: string };
    department: { name: string } | null;
  };
};

const listSelectCls =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

export default function BatchAssignForm({
  staff,
  checkpoints,
  inspectors,
  defaultDate,
  assignments,
}: {
  staff: Staff[];
  checkpoints: Checkpoint[];
  inspectors: Insp[];
  defaultDate: string;
  assignments: AssignmentRow[];
}) {
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState<"" | "HOUSEKEEPER" | "SECURITY">("");
  const shown = typeFilter
    ? staff.filter((s) => s.staffType === typeFilter)
    : staff;
  const [listQuery, setListQuery] = useState("");
  const [fCp, setFCp] = useState("");
  const q = listQuery.trim().toLowerCase();
  const shownAssignments = assignments.filter((a) => {
    if (typeFilter && a.user.staffType !== typeFilter) return false;
    if (fCp && a.checkpointId !== fCp) return false;
    if (!q) return true;
    const hay = `${a.user.name} ${a.checkpoint.name} ${a.checkpoint.site.name} ${
      a.checkpoint.department?.name ?? ""
    }`.toLowerCase();
    return hay.includes(q);
  });
  const [userId, setUserId] = useState(staff[0]?.id ?? "");
  const [checkpointId, setCheckpointId] = useState(checkpoints[0]?.id ?? "");

  function onTypeChange(v: "" | "HOUSEKEEPER" | "SECURITY") {
    setTypeFilter(v);
    const next = v ? staff.filter((s) => s.staffType === v) : staff;
    setUserId(next[0]?.id ?? "");
  }
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState("");
  const [note, setNote] = useState("");
  const [inspectorId, setInspectorId] = useState("");
  const [inspectorId2, setInspectorId2] = useState("");
  const [reviewPolicy, setReviewPolicy] = useState("BOTH");

  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function addItem() {
    setError("");
    if (!userId || !checkpointId || !date) {
      setError("กรุณาเลือกพนักงาน จุด และวันที่");
      return;
    }
    const u = staff.find((s) => s.id === userId);
    const c = checkpoints.find((c) => c.id === checkpointId);
    const insp = inspectors.find((x) => x.id === inspectorId);
    const insp2 = inspectors.find((x) => x.id === inspectorId2);
    setItems((cur) => [
      ...cur,
      {
        userId,
        checkpointId,
        date,
        startTime,
        note,
        inspectorId,
        inspectorId2,
        reviewPolicy,
        userName: u?.name ?? "",
        checkpointLabel: c ? checkpointLabel(c) : "",
        inspectorName: insp?.name ?? "",
        inspectorName2: insp2?.name ?? "",
      },
    ]);
    // ล้างเฉพาะหมายเหตุ/เวลา ให้เพิ่มงานถัดไปต่อได้ง่าย
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
      const res = await createAssignmentsBatch(
        items.map((it) => ({
          userId: it.userId,
          checkpointId: it.checkpointId,
          date: it.date,
          startTime: it.startTime || null,
          note: it.note || null,
          inspectorId: it.inspectorId || null,
          inspectorId2: it.inspectorId2 || null,
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

  return (
    <div className="space-y-3">
      {/* ฟอร์มกรอกทีละงาน */}
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
            <label className="label">วันที่</label>
            <input
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">เวลาเริ่ม</label>
            <TimeSelect24 value={startTime} onChange={setStartTime} />
          </div>
          <div>
            <label className="label">ผู้ตรวจคนที่ 1</label>
            <select
              className="input"
              value={inspectorId}
              onChange={(e) => {
                setInspectorId(e.target.value);
                // ถ้าคนที่ 1 ซ้ำกับคนที่ 2 ให้ล้างคนที่ 2
                if (e.target.value && e.target.value === inspectorId2)
                  setInspectorId2("");
              }}
            >
              <option value="">— ไม่ระบุ (ผู้ตรวจทุกคนเห็น) —</option>
              {inspectors.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">ผู้ตรวจคนที่ 2</label>
            <select
              className="input"
              value={inspectorId2}
              onChange={(e) => setInspectorId2(e.target.value)}
            >
              <option value="">— ไม่ระบุ —</option>
              {inspectors
                .filter((u) => u.id !== inspectorId)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
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
          <div className="sm:col-span-2">
            <label className="label">หมายเหตุ</label>
            <input
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <button type="button" className="btn-ghost" onClick={addItem}>
          ＋ เพิ่มลงรายการ
        </button>
      </div>

      {/* รายการที่เตรียมไว้ */}
      {items.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="p-3 font-medium">พนักงาน</th>
                <th className="p-3 font-medium">สถานที่ / จุด</th>
                <th className="p-3 font-medium whitespace-nowrap">วันที่</th>
                <th className="p-3 font-medium whitespace-nowrap">เวลา</th>
                <th className="p-3 font-medium whitespace-nowrap">ผู้ตรวจ</th>
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
                  <td className="p-3 text-gray-600 whitespace-nowrap">{it.date}</td>
                  <td className="p-3 text-gray-600 whitespace-nowrap">
                    {it.startTime || "—"}
                  </td>
                  <td className="p-3 text-gray-600 whitespace-nowrap">
                    {[it.inspectorName, it.inspectorName2]
                      .filter(Boolean)
                      .join(", ") || "—"}
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

      {/* รายการงานที่มอบหมายแล้ว (กรองตามประเภทที่เลือก) */}
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
        {shownAssignments.length === 0 && (
          <div className="p-4 text-center text-gray-500 text-sm">
            {typeFilter
              ? "ไม่มีงานของประเภทนี้ (ตั้งแต่วันนี้เป็นต้นไป)"
              : "ยังไม่มีงานที่มอบหมาย (ตั้งแต่วันนี้เป็นต้นไป)"}
          </div>
        )}
        {shownAssignments.map((a) => (
          <div key={a.id} className="p-3 flex items-center justify-between gap-2">
            <div>
              <div className="font-medium">
                {a.user.name} → {a.checkpoint.name}
              </div>
              <div className="text-sm text-gray-500">
                {a.checkpoint.department
                  ? `${a.checkpoint.department.name} · `
                  : ""}
                {a.checkpoint.site.name} · {fmtDate(a.scheduledDate)}
                {a.startTime ? ` · ${a.startTime} น.` : ""}
                {[a.inspector?.name, a.inspector2?.name].filter(Boolean).length
                  ? ` · ผู้ตรวจ: ${[a.inspector?.name, a.inspector2?.name]
                      .filter(Boolean)
                      .join(", ")}`
                  : ""}
                {` · ${reviewPolicyLabel[a.reviewPolicy] ?? a.reviewPolicy}`}
                {a.note ? ` · ${a.note}` : ""}
              </div>
            </div>
            <form action={deleteAssignment}>
              <input type="hidden" name="id" value={a.id} />
              <button className="text-red-600 text-sm">ลบ</button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
