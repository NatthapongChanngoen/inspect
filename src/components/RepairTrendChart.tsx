import { fmtDate } from "@/lib/date";

export type RepairDailyPoint = {
  date: string;
  newCount: number;
  resolved: number;
};

// กราฟแนวโน้มรายวันของงานซ่อม/ของหมด — วาด SVG เอง (ไม่ใช้ไลบรารีกราฟ)
// แท่งคู่ต่อวัน: แจ้งใหม่ (น้ำเงิน) กับ ปิดเสร็จ (เขียว)
// ใช้แท่งคู่ ไม่ใช่แท่งซ้อน เพราะ "ปิดเสร็จ" ไม่ได้เป็นส่วนย่อยของ "แจ้งใหม่"
// (วันหนึ่งอาจแจ้ง 0 แต่ปิดงานเก่าได้ 5)
export default function RepairTrendChart({
  daily,
}: {
  daily: RepairDailyPoint[];
}) {
  if (!daily.length) {
    return (
      <div className="card p-8 text-center text-sm text-gray-400">
        ไม่มีข้อมูลในช่วงนี้
      </div>
    );
  }

  const maxVal = Math.max(
    1,
    ...daily.map((d) => Math.max(d.newCount, d.resolved))
  );
  const H = 100;
  const STEP = 10;
  const BW = 3.5; // ความกว้างแท่งย่อย (2 แท่ง/วัน)
  const GAP = 0.6;
  const W = Math.max(daily.length * STEP, STEP);

  return (
    <div className="card p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-brand" />
          แจ้งใหม่
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />
          ปิดเสร็จ
        </span>
        <span className="ml-auto">สูงสุด {maxVal} รายการ/วัน</span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-40"
        role="img"
        aria-label="กราฟแนวโน้มรายวันของงานซ่อม/ของหมด"
      >
        {[0.5, 1].map((f) => (
          <line
            key={f}
            x1={0}
            x2={W}
            y1={H - f * H}
            y2={H - f * H}
            className="stroke-gray-100"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {daily.map((d, i) => {
          const newH = (d.newCount / maxVal) * H;
          const resH = (d.resolved / maxVal) * H;
          const cx = i * STEP + STEP / 2;
          return (
            <g key={d.date}>
              <rect
                x={cx - BW - GAP / 2}
                y={H - newH}
                width={BW}
                height={newH}
                className="fill-brand"
              />
              <rect
                x={cx + GAP / 2}
                y={H - resH}
                width={BW}
                height={resH}
                className="fill-emerald-500"
              />
            </g>
          );
        })}

        {/* ชั้นโปร่งใสไว้โชว์ tooltip ต่อวัน */}
        {daily.map((d, i) => (
          <rect
            key={`hit-${d.date}`}
            x={i * STEP}
            y={0}
            width={STEP}
            height={H}
            fill="transparent"
          >
            <title>
              {`${fmtDate(new Date(d.date))} · แจ้งใหม่ ${d.newCount} · ปิดเสร็จ ${d.resolved}`}
            </title>
          </rect>
        ))}
      </svg>

      <div className="flex justify-between text-xs text-gray-400">
        <span>{fmtDate(new Date(daily[0].date))}</span>
        <span>{fmtDate(new Date(daily[daily.length - 1].date))}</span>
      </div>
    </div>
  );
}
