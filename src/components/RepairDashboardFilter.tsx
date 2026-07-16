"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

type Dept = { id: string; name: string };

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// ตัวกรองเดือน + ฝ่าย (ตัวกรอง "เรื่อง" ย้ายไปเป็นแท็บที่ TabBar แล้ว —
// แต่ยังต้อง push `type` ต่อ เพื่อไม่ให้แท็บที่เลือกอยู่หลุด)
export default function RepairDashboardFilter({
  departments,
  departmentId,
  type,
  from,
  to,
}: {
  departments: Dept[];
  departmentId: string;
  type: string;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function apply(next: {
    departmentId?: string;
    type?: string;
    from?: string;
    to?: string;
  }) {
    const dep = next.departmentId ?? departmentId;
    const ty = next.type ?? type;
    const f = next.from ?? from;
    const t = next.to ?? to;
    const params = new URLSearchParams();
    if (f) params.set("from", f);
    if (t) params.set("to", t);
    if (dep) params.set("departmentId", dep);
    if (ty) params.set("type", ty);
    const qs = params.toString();
    startTransition(() =>
      router.push(qs ? `/admin/repairs?${qs}` : "/admin/repairs", {
        scroll: false,
      })
    );
  }

  function applyMonth(m: string) {
    if (!m) return;
    const [y, mo] = m.split("-").map(Number);
    const f = new Date(y, mo - 1, 1);
    const t = new Date(y, mo, 0); // วันสุดท้ายของเดือน
    apply({ from: iso(f), to: iso(t) });
  }

  const cls =
    "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500 shrink-0">เดือน</span>
        <input
          type="month"
          defaultValue={from.slice(0, 7)}
          onChange={(e) => applyMonth(e.target.value)}
          className={cls}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500 shrink-0">ฝ่าย</span>
        <select
          value={departmentId}
          onChange={(e) => apply({ departmentId: e.target.value })}
          className={cls}
        >
          <option value="">ทุกฝ่าย</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
