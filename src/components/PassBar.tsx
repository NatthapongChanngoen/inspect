// แถบแสดงอัตราผ่าน (%) — ใช้ร่วมกันในตาราง/กราฟแท่งของรายงานผู้บริหาร
export default function PassBar({
  value,
  showLabel = true,
}: {
  value: number;
  showLabel?: boolean;
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden min-w-[60px]">
        <div
          className="h-full bg-emerald-500 rounded-full"
          style={{ width: `${v}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-gray-600 w-9 text-right">{value}%</span>
      )}
    </div>
  );
}
