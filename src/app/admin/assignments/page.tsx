import { prisma } from "@/lib/db";
import { fmtDate, fmtDaysOfWeek, DOW_SHORT } from "@/lib/date";
import {
  createAssignment,
  deleteAssignment,
  createSchedule,
  deleteSchedule,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function AssignmentsPage() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [staff, checkpoints, assignments, schedules] = await Promise.all([
    prisma.user.findMany({
      where: { role: "STAFF", active: true },
      orderBy: { name: "asc" },
    }),
    prisma.checkpoint.findMany({
      where: { active: true },
      include: { site: true },
      orderBy: { name: "asc" },
    }),
    prisma.assignment.findMany({
      where: { scheduledDate: { gte: todayStart } },
      include: { user: true, checkpoint: { include: { site: true } } },
      orderBy: [{ scheduledDate: "asc" }, { createdAt: "asc" }],
    }),
    prisma.schedule.findMany({
      include: { user: true, checkpoint: { include: { site: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const todayStr = new Date(todayStart.getTime() - todayStart.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

  const noBasics = staff.length === 0 || checkpoints.length === 0;

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold">มอบหมายงาน</h1>

      {noBasics && (
        <div className="card p-4 text-sm text-gray-500">
          ต้องมีพนักงาน (บทบาทพนักงาน) และจุดเช็คอินอย่างน้อยอย่างละ 1 ก่อน
        </div>
      )}

      {/* ===== งานประจำ (ทำซ้ำ) ===== */}
      {!noBasics && (
        <section className="space-y-3">
          <div>
            <h2 className="font-semibold text-gray-800">งานประจำ (ทำซ้ำ)</h2>
            <p className="text-sm text-gray-500">
              ตั้งครั้งเดียว ระบบจะแสดงให้พนักงานทุกวันที่กำหนดเอง
            </p>
          </div>

          <form action={createSchedule} className="card p-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">พนักงาน</label>
                <select name="userId" className="input" required>
                  {staff.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">จุดเช็คอิน</label>
                <select name="checkpointId" className="input" required>
                  {checkpoints.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.site.name} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">รูปแบบ</label>
                <select name="preset" className="input" defaultValue="weekdays">
                  <option value="daily">ทุกวัน</option>
                  <option value="weekdays">จันทร์-ศุกร์</option>
                  <option value="weekends">เสาร์-อาทิตย์</option>
                  <option value="custom">กำหนดเอง (ติ๊กวันด้านล่าง)</option>
                </select>
              </div>
              <div>
                <label className="label">หมายเหตุ</label>
                <input name="note" className="input" />
              </div>
            </div>

            <div>
              <label className="label">เลือกวัน (เฉพาะเมื่อเลือก “กำหนดเอง”)</label>
              <div className="flex flex-wrap gap-3">
                {DOW_SHORT.map((d, i) => (
                  <label key={i} className="inline-flex items-center gap-1.5 text-sm">
                    <input type="checkbox" name="dow" value={i} className="w-4 h-4" />
                    {d}
                  </label>
                ))}
              </div>
            </div>

            <button className="btn-primary">เพิ่มงานประจำ</button>
          </form>

          <div className="card divide-y">
            {schedules.length === 0 && (
              <div className="p-4 text-center text-gray-500 text-sm">
                ยังไม่มีงานประจำ
              </div>
            )}
            {schedules.map((s) => (
              <div key={s.id} className="p-3 flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium">
                    {s.user.name} → {s.checkpoint.name}
                    {!s.active && (
                      <span className="badge bg-gray-200 text-gray-600 ml-2">ปิด</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    {s.checkpoint.site.name} ·{" "}
                    <span className="font-medium text-brand-dark">
                      {fmtDaysOfWeek(s.daysOfWeek)}
                    </span>
                    {s.note ? ` · ${s.note}` : ""}
                  </div>
                </div>
                <form action={deleteSchedule}>
                  <input type="hidden" name="id" value={s.id} />
                  <button className="text-red-600 text-sm">ลบ</button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ===== งานรายวัน (ครั้งเดียว) ===== */}
      {!noBasics && (
        <section className="space-y-3">
          <div>
            <h2 className="font-semibold text-gray-800">มอบหมายรายวัน (ครั้งเดียว)</h2>
            <p className="text-sm text-gray-500">สำหรับงานเฉพาะกิจในวันใดวันหนึ่ง</p>
          </div>

          <form action={createAssignment} className="card p-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">พนักงาน</label>
                <select name="userId" className="input" required>
                  {staff.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">จุดเช็คอิน</label>
                <select name="checkpointId" className="input" required>
                  {checkpoints.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.site.name} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">วันที่</label>
                <input
                  name="scheduledDate"
                  type="date"
                  className="input"
                  defaultValue={todayStr}
                  required
                />
              </div>
              <div>
                <label className="label">หมายเหตุ</label>
                <input name="note" className="input" />
              </div>
            </div>
            <button className="btn-primary">มอบหมายงาน</button>
          </form>

          <div className="card divide-y">
            {assignments.length === 0 && (
              <div className="p-4 text-center text-gray-500 text-sm">
                ยังไม่มีงานที่มอบหมาย (ตั้งแต่วันนี้เป็นต้นไป)
              </div>
            )}
            {assignments.map((a) => (
              <div key={a.id} className="p-3 flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium">
                    {a.user.name} → {a.checkpoint.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {a.checkpoint.site.name} · {fmtDate(a.scheduledDate)}
                    {a.note ? ` · ${a.note}` : ""}
                  </div>
                </div>
                <form action={deleteAssignment}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className="text-red-600 text-sm">ลบ</button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
