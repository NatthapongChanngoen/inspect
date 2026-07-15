"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export default function IssueFilters({
  type,
  status,
}: {
  type: string;
  status: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // รวมค่าตัวกรองปัจจุบัน + ค่าที่เปลี่ยน → push query (กรองทันที ไม่เด้งหน้า)
  function apply(patch: Partial<Record<string, string>>) {
    const merged: Record<string, string> = { type, status, ...patch };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    const qs = params.toString();
    startTransition(() =>
      router.push(qs ? `/admin/issues?${qs}` : "/admin/issues", {
        scroll: false,
      })
    );
  }

  const selectCls =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <select
        value={type}
        onChange={(e) => apply({ type: e.target.value })}
        className={selectCls}
      >
        <option value="">ทุกประเภท</option>
        <option value="REPAIR">ซ่อมอุปกรณ์</option>
        <option value="SUPPLY">ของหมด</option>
      </select>

      <select
        value={status}
        onChange={(e) => apply({ status: e.target.value })}
        className={selectCls}
      >
        <option value="">ทุกสถานะ</option>
        <option value="OPEN">รอดำเนินการ</option>
        <option value="IN_PROGRESS">กำลังแก้ไข</option>
        <option value="RESOLVED">เสร็จแล้ว</option>
      </select>
    </div>
  );
}
