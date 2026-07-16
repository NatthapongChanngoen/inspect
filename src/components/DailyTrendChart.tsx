import { fmtDate } from "@/lib/date";

export type DailyPoint = {
  date: string;
  total: number;
  approved: number;
  rejected: number;
  missed: number;
  passRate: number;
};

// กราฟแนวโน้มรายวัน — วาด SVG เอง (ไม่ใช้ไลบรารีกราฟ)
// แท่ง = จำนวนงานต่อวัน (ส่วนเขียว = ผ่าน) · เส้น = อัตราผ่าน %
export default function DailyTrendChart({ daily }: { daily: DailyPoint[] }) {
  if (!daily.length) {
    return (
      <div className="card p-8 text-center text-sm text-gray-400">
        ไม่มีข้อมูลในช่วงนี้
      </div>
    );
  }

  const maxTotal = Math.max(1, ...daily.map((d) => d.total));
  const H = 100;
  const STEP = 10;
  const BW = 6;
  const W = Math.max(daily.length * STEP, STEP);

  const linePoints = daily
    .map((d, i) => `${i * STEP + STEP / 2},${H - (d.passRate / 100) * H}`)
    .join(" ");

  const hasAnyWork = daily.some((d) => d.total > 0);

  return (
    <div className="card p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />
          งานที่ผ่าน
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-gray-200" />
          งานทั้งหมด
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-brand" />
          อัตราผ่าน %
        </span>
        <span className="ml-auto">สูงสุด {maxTotal} งาน/วัน</span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-40"
        role="img"
        aria-label="กราฟแนวโน้มรายวัน"
      >
        {/* เส้นแนวนอนอ้างอิง 50% / 100% */}
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
          const totalH = (d.total / maxTotal) * H;
          const approvedH = (d.approved / maxTotal) * H;
          const x = i * STEP + (STEP - BW) / 2;
          return (
            <g key={d.date}>
              <rect
                x={x}
                y={H - totalH}
                width={BW}
                height={totalH}
                className="fill-gray-200"
              />
              <rect
                x={x}
                y={H - approvedH}
                width={BW}
                height={approvedH}
                className="fill-emerald-500"
              />
            </g>
          );
        })}

        {hasAnyWork && (
          <polyline
            points={linePoints}
            className="fill-none stroke-brand"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        )}

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
              {`${fmtDate(new Date(d.date))} · งาน ${d.total} · ผ่าน ${
                d.approved
              } · ไม่ผ่าน ${d.rejected} · ขาด ${d.missed} · อัตราผ่าน ${
                d.passRate
              }%`}
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
