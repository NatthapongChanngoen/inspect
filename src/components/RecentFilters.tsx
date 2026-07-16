"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { checkpointLabel } from "@/lib/checkpoint";

type StaffOpt = { id: string; name: string };
type CheckpointOpt = {
  id: string;
  name: string;
  site: { name: string };
  department?: { name: string } | null;
};

type DepartmentOpt = { id: string; name: string };

export default function RecentFilters({
  staffList,
  checkpointList,
  departmentList,
  q,
  userId,
  staffType,
  departmentId,
  checkpointId,
  status,
}: {
  staffList: StaffOpt[];
  checkpointList: CheckpointOpt[];
  departmentList: DepartmentOpt[];
  q: string;
  userId: string;
  staffType: string;
  departmentId: string;
  checkpointId: string;
  status: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [text, setText] = useState(q);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // รวมค่าตัวกรองปัจจุบัน + ค่าที่เปลี่ยน → push เป็น query string (กรองทันที)
  function apply(patch: Partial<Record<string, string>>) {
    const merged: Record<string, string> = {
      q: text,
      userId,
      staffType,
      departmentId,
      checkpointId,
      status,
      ...patch,
    };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    const qs = params.toString();
    startTransition(() => router.push(qs ? `/admin?${qs}` : "/admin"));
  }

  // พิมพ์ค้นหา — กรองอัตโนมัติแบบหน่วงเวลาเล็กน้อย (ไม่ต้องกดปุ่ม)
  function onText(v: string) {
    setText(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => apply({ q: v }), 350);
  }

  const selectCls =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
      {/* ค้นหาข้อความ: ชื่อพนักงาน / สถานที่ / จุด */}
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          value={text}
          onChange={(e) => onText(e.target.value)}
          placeholder="ค้นหา พนักงาน / สถานที่ / จุด"
          className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>

      {/* พนักงาน */}
      <select
        value={userId}
        onChange={(e) => apply({ userId: e.target.value })}
        className={selectCls}
      >
        <option value="">ทุกพนักงาน</option>
        {staffList.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>

      {/* ประเภทพนักงาน */}
      <select
        value={staffType}
        onChange={(e) => apply({ staffType: e.target.value })}
        className={selectCls}
      >
        <option value="">ทุกประเภท</option>
        <option value="HOUSEKEEPER">แม่บ้าน</option>
        <option value="SECURITY">รปภ.</option>
      </select>

      {/* ฝ่าย */}
      <select
        value={departmentId}
        onChange={(e) => apply({ departmentId: e.target.value })}
        className={selectCls}
      >
        <option value="">ทุกฝ่าย</option>
        {departmentList.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>

      {/* สถานที่ / จุด */}
      <select
        value={checkpointId}
        onChange={(e) => apply({ checkpointId: e.target.value })}
        className={selectCls}
      >
        <option value="">ทุกสถานที่ / จุด</option>
        {checkpointList.map((c) => (
          <option key={c.id} value={c.id}>
            {checkpointLabel(c)}
          </option>
        ))}
      </select>

      {/* สถานะ */}
      <select
        value={status}
        onChange={(e) => apply({ status: e.target.value })}
        className={selectCls}
      >
        <option value="">ทุกสถานะ</option>
        <option value="IN_PROGRESS">กำลังทำงาน</option>
        <option value="SUBMITTED">รอตรวจ</option>
        <option value="APPROVED">ผ่าน</option>
        <option value="REJECTED">ไม่ผ่าน</option>
        <option value="MISSED">ไม่ได้ปฏิบัติงาน</option>
        <option value="NOT_REVIEWED">ไม่ได้รับการตรวจ</option>
      </select>

      {isPending && (
        <span className="sr-only" aria-live="polite">
          กำลังกรอง…
        </span>
      )}
    </div>
  );
}
