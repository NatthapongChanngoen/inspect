"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function UserFilters({
  q,
  role,
  staffType,
}: {
  q: string;
  role: string;
  staffType: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function apply(patch: Partial<Record<string, string>>) {
    const merged: Record<string, string> = { q, role, staffType, ...patch };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const qs = params.toString();
    startTransition(() =>
      router.push(qs ? `/admin/users?${qs}` : "/admin/users", { scroll: false })
    );
  }

  // พิมพ์ค้นหา — หน่วงเวลาเล็กน้อยกันรีเฟรชถี่เกิน
  function onText(v: string) {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => apply({ q: v }), 350);
  }

  const selectCls =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <input
        type="text"
        defaultValue={q}
        onChange={(e) => onText(e.target.value)}
        placeholder="ค้นหา ชื่อ / ชื่อผู้ใช้ / เลขบัตร"
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
      />
      <select
        value={role}
        onChange={(e) => apply({ role: e.target.value })}
        className={selectCls}
      >
        <option value="">ทุกบทบาท</option>
        <option value="STAFF">พนักงาน</option>
        <option value="INSPECTOR">ผู้ตรวจสอบ</option>
        <option value="ADMIN">ผู้ดูแลระบบ</option>
        <option value="EXECUTIVE">ผู้บริหาร</option>
      </select>
      <select
        value={staffType}
        onChange={(e) => apply({ staffType: e.target.value })}
        className={selectCls}
      >
        <option value="">ทุกประเภท</option>
        <option value="HOUSEKEEPER">แม่บ้าน</option>
        <option value="SECURITY">รปภ.</option>
      </select>
    </div>
  );
}
