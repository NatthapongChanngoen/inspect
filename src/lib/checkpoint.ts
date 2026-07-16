// ป้ายชื่อจุดเช็คอินมาตรฐานสำหรับ dropdown/ตัวกรอง: "สถานที่ — ชื่อจุด · ฝ่าย"
// (ถ้ายังไม่ระบุฝ่าย จะแสดงแค่ "สถานที่ — ชื่อจุด")
export type CheckpointLabelInput = {
  name: string;
  site: { name: string };
  department?: { name: string } | null;
};

export function checkpointLabel(cp: CheckpointLabelInput): string {
  const dept = cp.department?.name;
  return `${cp.site.name} — ${cp.name}${dept ? ` · ${dept}` : ""}`;
}
