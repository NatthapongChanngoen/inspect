import Link from "next/link";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { todayRange, fmtDate } from "@/lib/date";
import StatusBadge from "@/components/StatusBadge";
import ImageThumb from "@/components/ImageThumb";
import {
  MapPinIcon,
  CameraIcon,
  RefreshIcon,
  HistoryIcon,
  ArrowRightIcon,
  CalendarIcon,
} from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function StaffHome() {
  const user = await currentUser();
  if (!user) return null;
  const { start, end } = todayRange();

  const todayDow = start.getDay(); // 0=อาทิตย์ .. 6=เสาร์

  // งานวันนี้ = งานมอบหมายรายวัน (วันนี้) + งานประจำ (ตรงวันของสัปดาห์)
  const [oneOff, schedules, records, meDb] = await Promise.all([
    prisma.assignment.findMany({
      where: { userId: user.id, scheduledDate: { gte: start, lt: end } },
      include: { checkpoint: { include: { site: true, department: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.schedule.findMany({
      where: { userId: user.id, active: true, daysOfWeek: { has: todayDow } },
      include: { checkpoint: { include: { site: true, department: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.workRecord.findMany({
      where: { userId: user.id, checkInAt: { gte: start, lt: end } },
      include: { review: true },
      orderBy: { checkInAt: "desc" },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { staffType: true },
    }),
  ]);

  // แม่บ้าน/รปภ → เห็นแค่ปุ่มแจ้งปัญหา (ไม่เห็นงานซ่อม/เสนอราคาของฝ่าย)
  const isHousekeepingOrSecurity =
    meDb?.staffType === "HOUSEKEEPER" || meDb?.staffType === "SECURITY";

  // รวมเป็นรายการงานวันนี้ (ไม่ซ้ำจุด) — งานรายวันมาก่อน (หมายเหตุ/เวลาชนะ)
  type Task = {
    id: string;
    checkpointId: string;
    checkpoint: (typeof oneOff)[number]["checkpoint"];
    startTime: string | null;
    note: string | null;
  };
  const taskMap = new Map<string, Task>();
  for (const a of oneOff) {
    taskMap.set(a.checkpointId, {
      id: a.checkpointId,
      checkpointId: a.checkpointId,
      checkpoint: a.checkpoint,
      startTime: a.startTime,
      note: a.note,
    });
  }
  for (const s of schedules) {
    if (!taskMap.has(s.checkpointId)) {
      taskMap.set(s.checkpointId, {
        id: s.checkpointId,
        checkpointId: s.checkpointId,
        checkpoint: s.checkpoint,
        startTime: s.startTime,
        note: s.note,
      });
    }
  }
  // เรียงตามเวลาเริ่ม (ไม่มีเวลา = ไว้ท้าย)
  const tasks = [...taskMap.values()].sort((a, b) => {
    if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
    if (a.startTime) return -1;
    if (b.startTime) return 1;
    return 0;
  });

  // checkpointId -> งานล่าสุดของวันนี้
  const recByCheckpoint = new Map<string, (typeof records)[number]>();
  for (const r of records) {
    if (!recByCheckpoint.has(r.checkpointId)) recByCheckpoint.set(r.checkpointId, r);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">งานวันนี้</h1>
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-dark bg-brand/10 rounded-full px-3 py-1">
          <CalendarIcon size={15} />
          {fmtDate(start)}
        </span>
      </div>

      {tasks.length === 0 && (
        <div className="card p-8 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-3">
            <CalendarIcon size={26} />
          </div>
          <p className="text-gray-500">วันนี้ยังไม่มีงานที่ได้รับมอบหมาย</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {tasks.map((a) => {
          const rec = recByCheckpoint.get(a.checkpointId);
          return (
            <div key={a.id} className="card p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  {/* รูปประจำจุด (รูปแรก) — จุดที่ยังไม่มีรูปจะไม่แสดงอะไร */}
                  {a.checkpoint.photoPaths.length > 0 && (
                    <ImageThumb
                      src={`/api/files/${a.checkpoint.photoPaths[0]}`}
                      alt={`รูปจุด ${a.checkpoint.name}`}
                      thumbClassName="h-16 w-16 shrink-0 rounded-lg border object-cover bg-gray-50 cursor-zoom-in hover:opacity-90 transition"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{a.checkpoint.name}</div>
                    <div className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
                      <MapPinIcon size={14} className="shrink-0 text-gray-400" />
                      <span className="truncate">
                        {a.checkpoint.department
                          ? `${a.checkpoint.department.name} · `
                          : ""}
                        {a.checkpoint.site.name}
                      </span>
                    </div>
                    {a.startTime && (
                      <div className="inline-flex items-center gap-1 text-xs font-medium text-brand-dark bg-brand/10 rounded-full px-2 py-0.5 mt-1.5">
                        <CalendarIcon size={12} />
                        เริ่ม {a.startTime} น.
                      </div>
                    )}
                  </div>
                </div>
                {rec && <StatusBadge status={rec.status} />}
              </div>

              {/* หมายเหตุ — เต็มความกว้าง (ถ้าอยู่ในคอลัมน์ข้อความจะถูกรูปบีบจนอ่านยากบนมือถือ) */}
              {a.note && (
                <div className="text-sm text-gray-600 mt-2 bg-amber-50 rounded-lg px-2.5 py-1.5">
                  📌 {a.note}
                </div>
              )}

              {rec?.review?.comment && (
                <div className="mt-2 text-sm bg-gray-50 rounded-lg p-2.5 text-gray-700">
                  <span className="font-medium">หมายเหตุผู้ตรวจ:</span> {rec.review.comment}
                </div>
              )}

              {rec?.status === "RETURNED" && rec.returnReason && (
                <div className="mt-2 text-sm bg-orange-50 rounded-lg p-2.5 text-orange-800">
                  <span className="font-medium">🔁 ตีกลับให้แก้:</span> {rec.returnReason}
                </div>
              )}

              <div className="mt-3 pt-1 mt-auto">
                {!rec && (
                  <Link href={`/staff/checkin/${a.checkpointId}`} className="btn-primary btn-lg w-full">
                    <MapPinIcon size={18} />
                    เริ่มงาน (เช็คอิน)
                  </Link>
                )}
                {rec?.status === "IN_PROGRESS" && (
                  <Link href={`/staff/work/${rec.id}`} className="btn-success btn-lg w-full">
                    <CameraIcon size={18} />
                    ถ่ายรูปหลังทำงาน / ส่งงาน
                  </Link>
                )}
                {rec?.status === "RETURNED" && (
                  <Link href={`/staff/work/${rec.id}`} className="btn-success btn-lg w-full">
                    <CameraIcon size={18} />
                    ถ่ายรูปใหม่ / ส่งงานอีกครั้ง
                  </Link>
                )}
                {rec?.status === "REJECTED" && (
                  <Link href={`/staff/checkin/${a.checkpointId}`} className="btn-ghost btn-lg w-full">
                    <RefreshIcon size={18} />
                    ทำใหม่อีกครั้ง
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Link href="/staff/report" className="btn-ghost btn-lg w-full">
        🛠️ แจ้งปัญหา (ซ่อมอุปกรณ์ / ของหมด)
      </Link>

      {!isHousekeepingOrSecurity && (
        <Link href="/issues" className="btn-ghost btn-lg w-full">
          📋 งานซ่อม / เสนอราคา (ของฝ่าย)
        </Link>
      )}

      <div className="pt-1">
        <Link
          href="/staff/history"
          className="inline-flex items-center gap-1.5 text-brand-dark text-sm font-semibold hover:gap-2.5 transition-all"
        >
          <HistoryIcon size={16} />
          ดูประวัติงานทั้งหมด
          <ArrowRightIcon size={16} />
        </Link>
      </div>
    </div>
  );
}
