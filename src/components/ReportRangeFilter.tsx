"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function ReportRangeFilter({
  from,
  to,
  departmentId = "",
  view = "",
}: {
  from: string; // YYYY-MM-DD (รวม)
  to: string; // YYYY-MM-DD (รวม)
  departmentId?: string;
  view?: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [cFrom, setCFrom] = useState(from);
  const [cTo, setCTo] = useState(to);
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState("");

  function push(f: string, t: string) {
    const dep = departmentId ? `&departmentId=${departmentId}` : "";
    const vw = view ? `&view=${view}` : "";
    startTransition(() =>
      router.push(`/admin/executive?from=${f}&to=${t}${dep}${vw}`, {
        scroll: false,
      })
    );
  }

  function applyMonth(m: string) {
    if (!m) return;
    const [y, mo] = m.split("-").map(Number);
    const f = new Date(y, mo - 1, 1);
    const t = new Date(y, mo, 0); // วันสุดท้ายของเดือน
    push(iso(f), iso(t));
  }

  async function sendLine() {
    setSending(true);
    setNote("");
    try {
      const res = await fetch("/api/admin/jobs/exec-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to,
          label: `ช่วง ${from} ถึง ${to}`,
        }),
      });
      const data = await res.json();
      setNote(res.ok ? `ส่งเข้า LINE แล้ว (${data.sent} คน)` : data.error || "ส่งไม่สำเร็จ");
    } catch {
      setNote("เกิดข้อผิดพลาด");
    }
    setSending(false);
  }

  const inputCls =
    "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

  return (
    <div className="card p-3 flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">เดือน</label>
        <input
          type="month"
          defaultValue={from.slice(0, 7)}
          onChange={(e) => applyMonth(e.target.value)}
          className={inputCls}
        />
      </div>

      <div className="flex items-end gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            ตั้งแต่
          </label>
          <input
            type="date"
            value={cFrom}
            onChange={(e) => setCFrom(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">ถึง</label>
          <input
            type="date"
            value={cTo}
            onChange={(e) => setCTo(e.target.value)}
            className={inputCls}
          />
        </div>
        <button
          type="button"
          className="btn-ghost !py-2 text-sm border border-gray-300"
          onClick={() => cFrom && cTo && push(cFrom, cTo)}
        >
          ใช้ช่วงนี้
        </button>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {note && <span className="text-xs text-gray-500">{note}</span>}
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
          onClick={sendLine}
          disabled={sending}
        >
          {sending ? "กำลังส่ง…" : "ส่งสรุปเข้า LINE"}
        </button>
      </div>
    </div>
  );
}
