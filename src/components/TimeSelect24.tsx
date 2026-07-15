"use client";

import { useEffect, useRef, useState } from "react";

// ช่องเวลา 24 ชั่วโมง — พิมพ์เองก็ได้ (เช่น 14:30) หรือกดปุ่มนาฬิกาเพื่อหมุนเลือก (wheel)
// เก็บค่าเป็น "HH:mm"

const ITEM_H = 40;
const VISIBLE = 5;
const PAD = ((VISIBLE - 1) / 2) * ITEM_H;
const CONT_H = VISIBLE * ITEM_H;

function Wheel({
  items,
  index,
  onPick,
}: {
  items: string[];
  index: number;
  onPick: (i: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = index * ITEM_H;
  }, [index]);

  function onScroll() {
    const el = ref.current;
    if (!el) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const i = Math.min(
        items.length - 1,
        Math.max(0, Math.round(el.scrollTop / ITEM_H))
      );
      el.scrollTo({ top: i * ITEM_H, behavior: "smooth" });
      if (i !== index) onPick(i);
    }, 120);
  }

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      className="tw-wheel overflow-y-auto"
      style={{
        height: CONT_H,
        width: 56,
        scrollSnapType: "y mandatory",
        scrollbarWidth: "none",
      }}
    >
      <div style={{ paddingTop: PAD, paddingBottom: PAD }}>
        {items.map((it, i) => (
          <button
            key={it}
            type="button"
            onClick={() => onPick(i)}
            className={`flex w-full items-center justify-center tabular-nums transition-colors ${
              i === index
                ? "text-brand-dark font-bold text-xl"
                : "text-gray-400 text-base"
            }`}
            style={{ height: ITEM_H, scrollSnapAlign: "center" }}
          >
            {it}
          </button>
        ))}
      </div>
    </div>
  );
}

function WheelPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const mins = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
  const [vh, vm] =
    value && value.includes(":") ? value.split(":") : ["00", "00"];
  const hIdx = Math.max(0, hours.indexOf(vh.padStart(2, "0")));
  const mIdx = Math.max(0, mins.indexOf(vm.padStart(2, "0")));

  return (
    <div
      className="relative inline-flex items-center px-2"
      style={{ height: CONT_H }}
    >
      <style>{`.tw-wheel::-webkit-scrollbar{display:none}`}</style>
      <Wheel
        items={hours}
        index={hIdx}
        onPick={(i) => onChange(`${hours[i]}:${mins[mIdx]}`)}
      />
      <span className="px-1 text-xl font-bold text-gray-400">:</span>
      <Wheel
        items={mins}
        index={mIdx}
        onPick={(i) => onChange(`${hours[hIdx]}:${mins[i]}`)}
      />
      <div
        className="pointer-events-none absolute inset-x-0 border-y border-brand/40 bg-brand/5"
        style={{ top: PAD, height: ITEM_H }}
      />
    </div>
  );
}

export default function TimeSelect24({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);

  // พิมพ์เอง — คำนวณจากตัวเลขล้วนเสมอ (กันบั๊ก ":" ซ้อน) → HH:mm
  function handle(raw: string) {
    const d = raw.replace(/\D/g, "").slice(0, 4);
    const out = d.length >= 3 ? `${d.slice(0, d.length - 2)}:${d.slice(-2)}` : d;
    onChange(out);
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <input
          type="text"
          className="input"
          inputMode="numeric"
          placeholder="เช่น 14:30"
          value={value}
          onChange={(e) => handle(e.target.value)}
          maxLength={5}
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
          aria-label="เลือกเวลาแบบหมุน"
          title="หมุนเลือกเวลา"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        </button>
      </div>

      {open && (
        <>
          {/* คลิกพื้นหลังเพื่อปิด */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 rounded-xl border border-gray-200 bg-white shadow-lg p-2">
            <WheelPicker value={value} onChange={onChange} />
            <button
              type="button"
              className="btn-primary w-full mt-1 !py-2 text-sm"
              onClick={() => setOpen(false)}
            >
              เสร็จ
            </button>
          </div>
        </>
      )}
    </div>
  );
}
