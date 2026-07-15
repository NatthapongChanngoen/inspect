"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

const PRESETS = [7, 30, 90];

// ปุ่มช่วงเวลาลัด 7 / 30 / 90 วัน (นับถึงวันนี้) — ใช้คู่กับตัวเลือกเดือน/ช่วงวันที่เดิม
// params = พารามิเตอร์อื่นที่ต้องคงไว้ (เช่น view / departmentId / type / cp)
export default function RangePills({
  basePath,
  from,
  to,
  params = {},
}: {
  basePath: string;
  from: string;
  to: string;
  params?: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = iso(today);

  // ช่วงที่เลือกอยู่ตรงกับ preset ไหน (to = วันนี้ และ from = วันนี้ - (N-1))
  function isActive(days: number): boolean {
    if (to !== todayStr) return false;
    const start = new Date(today);
    start.setDate(start.getDate() - (days - 1));
    return from === iso(start);
  }

  function go(days: number) {
    const start = new Date(today);
    start.setDate(start.getDate() - (days - 1));
    const q = new URLSearchParams();
    q.set("from", iso(start));
    q.set("to", todayStr);
    for (const [k, v] of Object.entries(params)) {
      if (v) q.set(k, v);
    }
    startTransition(() =>
      router.push(`${basePath}?${q.toString()}`, { scroll: false })
    );
  }

  return (
    <div className="flex gap-2">
      {PRESETS.map((d) => {
        const active = isActive(d);
        return (
          <button
            key={d}
            type="button"
            onClick={() => go(d)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              active
                ? "bg-brand text-white shadow-sm"
                : "bg-white text-gray-600 border border-gray-200 hover:border-brand hover:text-brand-dark"
            }`}
          >
            {d} วัน
          </button>
        );
      })}
    </div>
  );
}
