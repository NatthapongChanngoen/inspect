"use client";

import { useState } from "react";
import { DOW_SHORT, fmtDaysOfWeek } from "@/lib/date";

const TH_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

// เลือกรูปแบบงานประจำ + เลือกวันแบบปฏิทินเดือน (โชว์เฉพาะเมื่อ "กำหนดเอง")
// คลิกวันใดในปฏิทิน = เลือก "วันนั้นของสัปดาห์" → ไฮไลต์ทุกวันที่ตรง (งานประจำทำซ้ำ)
// ส่งค่า preset + dow (หลายค่า) เข้า <form action={createSchedule}> ตามเดิม
export default function ScheduleDaysPicker() {
  const [preset, setPreset] = useState("weekdays");
  const [dows, setDows] = useState<number[]>([]);

  const now = new Date();
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });

  function toggleDow(w: number) {
    setDows((cur) => (cur.includes(w) ? cur.filter((x) => x !== w) : [...cur, w]));
  }
  function shiftMonth(delta: number) {
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  const isCustom = preset === "custom";

  // สร้างช่องปฏิทิน (เริ่มต้นด้วยช่องว่างตามวันแรกของเดือน)
  const firstDow = new Date(view.y, view.m, 1).getDay(); // 0=อา
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const isToday = (d: number) =>
    view.y === now.getFullYear() &&
    view.m === now.getMonth() &&
    d === now.getDate();

  return (
    <div className="space-y-3">
      <div>
        <label className="label">รูปแบบ</label>
        <select
          name="preset"
          className="input"
          value={preset}
          onChange={(e) => setPreset(e.target.value)}
        >
          <option value="daily">ทุกวัน</option>
          <option value="weekdays">จันทร์-ศุกร์</option>
          <option value="weekends">เสาร์-อาทิตย์</option>
          <option value="custom">กำหนดเอง (เลือกวันจากปฏิทิน)</option>
        </select>
      </div>

      {isCustom && (
        <div>
          <label className="label">เลือกวัน (คลิกวันในปฏิทิน = ทำซ้ำทุกวันนั้นของสัปดาห์)</label>

          <div className="rounded-xl border border-gray-200 p-3 select-none max-w-sm">
            {/* หัวปฏิทิน: เดือน + ปุ่มเลื่อนเดือน */}
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-600"
                aria-label="เดือนก่อนหน้า"
              >
                ‹
              </button>
              <div className="font-semibold text-gray-800">
                {TH_MONTHS[view.m]} {view.y + 543}
              </div>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-600"
                aria-label="เดือนถัดไป"
              >
                ›
              </button>
            </div>

            {/* หัวคอลัมน์วัน (กดเพื่อเลือก/ยกเลิกทั้งคอลัมน์) */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DOW_SHORT.map((d, w) => {
                const active = dows.includes(w);
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => toggleDow(w)}
                    className={`text-xs font-semibold py-1 rounded ${
                      active ? "text-brand-dark" : "text-gray-400"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>

            {/* ช่องวันที่ */}
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, i) => {
                if (d === null) return <div key={i} />;
                const w = new Date(view.y, view.m, d).getDay();
                const active = dows.includes(w);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDow(w)}
                    className={`aspect-square rounded-lg text-sm transition-colors ${
                      active
                        ? "bg-brand text-white font-semibold"
                        : "text-gray-700 hover:bg-gray-100"
                    } ${isToday(d) && !active ? "ring-1 ring-brand" : ""}`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-xs mt-1.5">
            {dows.length === 0 ? (
              <span className="text-amber-600">เลือกอย่างน้อย 1 วัน</span>
            ) : (
              <span className="text-gray-500">
                ทำซ้ำทุก:{" "}
                <span className="font-medium text-brand-dark">
                  {fmtDaysOfWeek(dows)}
                </span>
              </span>
            )}
          </p>

          {/* ส่งค่าวันที่เลือกเข้าฟอร์ม (server action อ่าน getAll("dow")) */}
          {dows.map((w) => (
            <input key={w} type="hidden" name="dow" value={w} />
          ))}
        </div>
      )}
    </div>
  );
}
