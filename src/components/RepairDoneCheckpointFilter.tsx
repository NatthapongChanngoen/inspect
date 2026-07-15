"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

type Cp = { id: string; name: string; site: string };

// ตัวกรอง "จุด" เฉพาะ section งานซ่อมที่เสร็จแล้ว — คงพารามิเตอร์อื่น (เดือน/ฝ่าย/เรื่อง) ไว้
export default function RepairDoneCheckpointFilter({
  checkpoints,
  checkpointId,
  from,
  to,
  departmentId,
  type,
}: {
  checkpoints: Cp[];
  checkpointId: string;
  from: string;
  to: string;
  departmentId: string;
  type: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function apply(cp: string) {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (departmentId) params.set("departmentId", departmentId);
    if (type) params.set("type", type);
    if (cp) params.set("cp", cp);
    const qs = params.toString();
    startTransition(() =>
      router.push(qs ? `/admin/repairs?${qs}` : "/admin/repairs", {
        scroll: false,
      })
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500 shrink-0">จุด</span>
      <select
        value={checkpointId}
        onChange={(e) => apply(e.target.value)}
        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand max-w-full"
      >
        <option value="">ทุกจุด (เลือกเพื่อค้นหา)</option>
        {checkpoints.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} · {c.site}
          </option>
        ))}
      </select>
    </div>
  );
}
