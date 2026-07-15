import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtDateTime } from "@/lib/date";
import StatusBadge from "@/components/StatusBadge";
import { AlertTriangleIcon, MapPinIcon, ArrowRightIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

type Range = "today" | "7d" | "all";

// ช่วงเวลาเริ่มต้นของตัวกรอง (คืน null = ไม่จำกัด)
function rangeStart(range: Range): Date | null {
  if (range === "all") return null;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (range === "7d") d.setDate(d.getDate() - 6); // วันนี้ + ย้อนหลัง 6 วัน
  return d;
}

const FILTERS: { key: Range; label: string }[] = [
  { key: "today", label: "วันนี้" },
  { key: "7d", label: "7 วัน" },
  { key: "all", label: "ทั้งหมด" },
];

export default async function SuspiciousList({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const sp = await searchParams;
  const range: Range =
    sp.range === "7d" || sp.range === "all" ? sp.range : "today";
  const start = rangeStart(range);

  const records = await prisma.workRecord.findMany({
    where: {
      suspicious: true,
      ...(start ? { checkInAt: { gte: start } } : {}),
    },
    include: {
      checkpoint: { include: { site: true, department: true } },
      user: true,
    },
    orderBy: { checkInAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-amber-100 text-amber-600">
          <AlertTriangleIcon size={20} />
        </span>
        <div>
          <h1 className="text-xl font-bold text-gray-900">รายการน่าสงสัย</h1>
          <p className="text-sm text-gray-500">
            การเช็คอินที่ระบบพบสัญญาณอาจปลอมตำแหน่ง (fake GPS)
          </p>
        </div>
      </div>

      {/* ตัวกรองช่วงเวลา */}
      <div className="flex gap-1">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/suspicious?range=${f.key}`}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              range === f.key
                ? "bg-brand text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {records.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          ไม่พบรายการน่าสงสัยในช่วงนี้ 🎉
        </div>
      ) : (
        <>
          <div className="text-sm text-gray-500">พบ {records.length} รายการ</div>
          <div className="space-y-3">
            {records.map((r) => {
              const mapsUrl =
                r.checkInLat != null && r.checkInLng != null
                  ? `https://www.google.com/maps?q=${r.checkInLat},${r.checkInLng}`
                  : null;
              return (
                <div
                  key={r.id}
                  className="card p-4 border-l-4 border-amber-400 space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold">{r.checkpoint.name}</div>
                      <div className="text-sm text-gray-500">
                        {r.checkpoint.department
                          ? `${r.checkpoint.department.name} · `
                          : ""}
                        {r.checkpoint.site.name}
                      </div>
                      <div className="text-sm text-gray-600 mt-0.5">
                        พนักงาน: {r.user.name} · {fmtDateTime(r.checkInAt)}
                      </div>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>

                  {/* เหตุผลที่ตั้งธง */}
                  <ul className="flex flex-wrap gap-1.5">
                    {r.suspiciousFlags.map((f, i) => (
                      <li
                        key={i}
                        className="badge bg-amber-100 text-amber-800 text-xs"
                      >
                        ⚠️ {f}
                      </li>
                    ))}
                  </ul>

                  {/* รายละเอียดเชิงเทคนิค ไว้ตรวจย้อนหลัง */}
                  <div className="text-xs text-gray-500 grid grid-cols-2 gap-x-4 gap-y-0.5">
                    {r.distanceMeters != null && (
                      <div>ระยะจากจุด: {Math.round(r.distanceMeters)} ม.</div>
                    )}
                    {r.checkInAccuracy != null && (
                      <div>ความแม่นยำ: ±{Math.round(r.checkInAccuracy)} ม.</div>
                    )}
                    {r.gpsTimestamp != null && (
                      <div>เวลาพิกัด: {fmtDateTime(r.gpsTimestamp)}</div>
                    )}
                    {r.ipAddress && <div>IP: {r.ipAddress}</div>}
                  </div>
                  {r.userAgent && (
                    <div className="text-xs text-gray-400 truncate">
                      อุปกรณ์: {r.userAgent}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    {mapsUrl && (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        className="btn-ghost text-sm"
                      >
                        <MapPinIcon size={16} />
                        ดูตำแหน่งบนแผนที่
                      </a>
                    )}
                    <Link
                      href={`/inspector/${r.id}`}
                      className="btn-ghost text-sm"
                    >
                      <ArrowRightIcon size={16} />
                      เปิดหน้าตรวจงาน
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
