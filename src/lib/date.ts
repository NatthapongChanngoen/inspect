// ช่วงเวลา "วันนี้" (เที่ยงคืนถึงเที่ยงคืนถัดไป)
export function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function fmtDateTime(d: Date | string): string {
  return new Date(d).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("th-TH", { dateStyle: "medium" });
}

export function fmtTime(d: Date | string): string {
  return new Date(d).toLocaleTimeString("th-TH", { timeStyle: "short" });
}

// ระยะเวลาที่ใช้ทำงาน (จากเริ่ม → เสร็จ) เป็นข้อความไทย เช่น "23 นาที", "1 ชม 5 นาที"
export function fmtDuration(
  from: Date | string | null | undefined,
  to: Date | string | null | undefined
): string {
  if (!from || !to) return "—";
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 1) return "ไม่ถึง 1 นาที";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} นาที`;
  if (m === 0) return `${h} ชม`;
  return `${h} ชม ${m} นาที`;
}

// ชื่อย่อวัน (0=อาทิตย์ .. 6=เสาร์)
export const DOW_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

// แปลงชุดวันของสัปดาห์เป็นข้อความอ่านง่าย
export function fmtDaysOfWeek(days: number[]): string {
  if (!days || days.length === 0) return "—";
  const set = new Set(days);
  const sameSet = (arr: number[]) =>
    arr.length === set.size && arr.every((d) => set.has(d));
  if (sameSet([0, 1, 2, 3, 4, 5, 6])) return "ทุกวัน";
  if (sameSet([1, 2, 3, 4, 5])) return "จันทร์-ศุกร์";
  if (sameSet([0, 6])) return "เสาร์-อาทิตย์";
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => DOW_SHORT[d])
    .join(" ");
}

// เกณฑ์ผ่อนผัน "เข้าสาย" (นาที) — เช็คอินช้ากว่าเวลาเริ่มเกินค่านี้ = สาย
export const LATE_GRACE_MINUTES = 5;

// ข้อมูลการเข้าสายสำหรับแสดงผล
export function lateInfo(lateMinutes: number | null | undefined): {
  late: boolean;
  label: string;
} {
  if (lateMinutes == null) return { late: false, label: "" };
  const late = lateMinutes > LATE_GRACE_MINUTES;
  return {
    late,
    label: late ? `เข้าสาย ${lateMinutes} นาที` : "ตรงเวลา",
  };
}

// จำนวนวันเต็มที่ผ่านมาแล้วนับจาก d ถึงตอนนี้ (ไทยไม่มี DST → หารตรง ๆ ได้)
export function daysSince(d: Date | string): number {
  const ms = Date.now() - new Date(d).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.floor(ms / 86400000);
}

// ช่วงวันของงาน (เข้าซ่อม → เสร็จ) เป็นข้อความไทย เช่น "3 วัน"
// นับแบบรวมวันแรก (inclusive) — เข้าซ่อมและเสร็จวันเดียวกัน = "1 วัน" ไม่ใช่ "0 วัน"
// คืน "—" เมื่อไม่ได้กรอกวันใดวันหนึ่ง หรือวันเสร็จมาก่อนวันเข้าซ่อม
// (ฟอร์มเสนอราคาไม่ได้บังคับ และ createRepairProposal ไม่ validate ว่า finish >= start)
export function fmtDaySpan(
  start: Date | string | null | undefined,
  finish: Date | string | null | undefined
): string {
  if (!start || !finish) return "—";
  const ms = new Date(finish).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  return `${Math.round(ms / 86400000) + 1} วัน`;
}

// คืนจำนวนนาที (ตัวเลข) สำหรับใช้คำนวณ/แสดง
export function durationMinutes(
  from: Date | string | null | undefined,
  to: Date | string | null | undefined
): number | null {
  if (!from || !to) return null;
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.round(ms / 60000);
}
