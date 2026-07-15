"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

type Dept = { id: string; name: string };

// ตัวกรองฝ่าย (เรื่อง/view ย้ายไปเป็นแท็บที่ ExecutiveTabs แล้ว)
export default function ExecutiveDeptFilter({
  departments,
  departmentId,
  view,
  from,
  to,
}: {
  departments: Dept[];
  departmentId: string;
  view: string;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function apply(dep: string) {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (dep) params.set("departmentId", dep);
    if (view) params.set("view", view);
    const qs = params.toString();
    startTransition(() =>
      router.push(qs ? `/admin/executive?${qs}` : "/admin/executive", {
        scroll: false,
      })
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500 shrink-0">ฝ่าย</span>
      <select
        value={departmentId}
        onChange={(e) => apply(e.target.value)}
        className="input !py-2"
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
