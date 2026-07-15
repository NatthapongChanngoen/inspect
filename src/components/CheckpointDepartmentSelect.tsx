"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCheckpointDepartment } from "@/app/admin/actions";

type Dept = { id: string; name: string };

export default function CheckpointDepartmentSelect({
  checkpointId,
  departmentId,
  departments,
}: {
  checkpointId: string;
  departmentId: string | null;
  departments: Dept[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(value: string) {
    startTransition(async () => {
      await setCheckpointDepartment(checkpointId, value || null);
      router.refresh();
    });
  }

  return (
    <label className="mt-2 flex items-center gap-2 text-sm">
      <span className="text-gray-500 shrink-0">ฝ่าย</span>
      <select
        className="flex-1 min-w-0 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-50"
        value={departmentId ?? ""}
        disabled={pending}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— ไม่ระบุ —</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
    </label>
  );
}
