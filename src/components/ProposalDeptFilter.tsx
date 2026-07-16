"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

type Dept = { id: string; name: string };

// ตัวกรองฝ่ายของแดชบอร์ดข้อเสนอ (/issues) — คง sort ที่เลือกอยู่ไว้
export default function ProposalDeptFilter({
  departments,
  departmentId,
  sort,
}: {
  departments: Dept[];
  departmentId: string;
  sort: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function apply(dep: string) {
    const params = new URLSearchParams();
    if (sort) params.set("sort", sort);
    if (dep) params.set("departmentId", dep);
    const qs = params.toString();
    startTransition(() =>
      router.push(qs ? `/issues?${qs}` : "/issues", { scroll: false })
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500 shrink-0">ฝ่าย</span>
      <select
        value={departmentId}
        onChange={(e) => apply(e.target.value)}
        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
      >
        <option value="">ทุกฝ่าย</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
    </div>
  );
}
