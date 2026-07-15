"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export type TabItem = { key: string; label: string };

// แท็บทั่วไป — คุม query param ตัวใดตัวหนึ่ง (เช่น ?view= หรือ ?type=)
// params = พารามิเตอร์อื่นที่ต้องคงไว้ (ค่าว่างจะถูกตัดทิ้ง)
export default function TabBar({
  basePath,
  paramName,
  current,
  tabs,
  params = {},
}: {
  basePath: string;
  paramName: string;
  current: string;
  tabs: TabItem[];
  params?: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function go(next: string) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v) q.set(k, v);
    }
    if (next) q.set(paramName, next);
    const qs = q.toString();
    startTransition(() =>
      router.push(qs ? `${basePath}?${qs}` : basePath, { scroll: false })
    );
  }

  return (
    <div className="flex gap-1.5 overflow-x-auto rounded-xl bg-gray-100 p-1">
      {tabs.map((t) => {
        const active = current === t.key;
        return (
          <button
            key={t.key || "__default"}
            type="button"
            onClick={() => go(t.key)}
            className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
              active
                ? "bg-brand-darker text-white shadow-sm"
                : "text-gray-600 hover:bg-white/70"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
