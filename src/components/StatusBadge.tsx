const map: Record<string, { label: string; cls: string; dot: string }> = {
  IN_PROGRESS: { label: "กำลังทำงาน", cls: "bg-amber-100 text-amber-800", dot: "bg-amber-500" },
  SUBMITTED: { label: "รอตรวจ", cls: "bg-blue-100 text-blue-800", dot: "bg-blue-500" },
  APPROVED: { label: "ผ่าน", cls: "bg-green-100 text-green-800", dot: "bg-green-500" },
  REJECTED: { label: "ไม่ผ่าน", cls: "bg-red-100 text-red-800", dot: "bg-red-500" },
  MISSED: { label: "ไม่ได้ปฏิบัติงาน", cls: "bg-gray-200 text-gray-700", dot: "bg-gray-500" },
  NOT_REVIEWED: { label: "ไม่ได้รับการตรวจ", cls: "bg-orange-100 text-orange-800", dot: "bg-orange-500" },
  RETURNED: { label: "ตีกลับให้แก้", cls: "bg-purple-100 text-purple-800", dot: "bg-purple-500" },
};

export default function StatusBadge({ status }: { status: string }) {
  const s =
    map[status] ?? { label: status, cls: "bg-gray-100 text-gray-700", dot: "bg-gray-400" };
  return (
    <span className={`badge ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
