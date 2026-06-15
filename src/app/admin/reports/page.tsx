import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtDateTime, fmtDuration } from "@/lib/date";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string; checkpointId?: string; date?: string }>;
}) {
  const sp = await searchParams;
  const userId = sp.userId || "";
  const checkpointId = sp.checkpointId || "";
  const date = sp.date || "";

  // ตัวเลือกสำหรับฟอร์มกรอง
  const [staff, checkpoints] = await Promise.all([
    prisma.user.findMany({
      where: { role: "STAFF" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.checkpoint.findMany({
      include: { site: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // เงื่อนไขกรอง
  const where: {
    submittedAt: { not: null };
    userId?: string;
    checkpointId?: string;
    checkInAt?: { gte: Date; lt: Date };
  } = { submittedAt: { not: null } };
  if (userId) where.userId = userId;
  if (checkpointId) where.checkpointId = checkpointId;
  if (date) {
    const start = new Date(date + "T00:00:00");
    if (!Number.isNaN(start.getTime())) {
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      where.checkInAt = { gte: start, lt: end };
    }
  }

  const records = await prisma.workRecord.findMany({
    where,
    include: {
      user: true,
      checkpoint: { include: { site: true } },
    },
    orderBy: { checkInAt: "desc" },
    take: 300,
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">รายงานเวลาทำงาน</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          เวลาที่พนักงานใช้ทำงานแต่ละจุด (นับจากเช็คอิน → ส่งงาน)
        </p>
      </div>

      {/* ฟอร์มกรอง */}
      <form className="card p-4 grid sm:grid-cols-4 gap-3 items-end" method="get">
        <div>
          <label className="label">พนักงาน</label>
          <select name="userId" className="input" defaultValue={userId}>
            <option value="">ทั้งหมด</option>
            {staff.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">จุดเช็คอิน</label>
          <select name="checkpointId" className="input" defaultValue={checkpointId}>
            <option value="">ทั้งหมด</option>
            {checkpoints.map((c) => (
              <option key={c.id} value={c.id}>
                {c.site.name} — {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">วันที่</label>
          <input type="date" name="date" className="input" defaultValue={date} />
        </div>
        <div className="flex gap-2">
          <button className="btn-primary flex-1">กรอง</button>
          <a href="/admin/reports" className="btn-ghost">
            ล้าง
          </a>
        </div>
      </form>

      {/* ตารางรายครั้ง */}
      {records.length === 0 ? (
        <EmptyState text="ไม่พบงานที่ส่งแล้วตามเงื่อนไข" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="p-3 font-medium">พนักงาน</th>
                <th className="p-3 font-medium">สถานที่ / จุด</th>
                <th className="p-3 font-medium whitespace-nowrap">เข้า</th>
                <th className="p-3 font-medium whitespace-nowrap">ส่งงาน</th>
                <th className="p-3 font-medium whitespace-nowrap">เวลาที่ใช้</th>
                <th className="p-3 font-medium">ผล</th>
                <th className="p-3 font-medium text-right">รายละเอียด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="p-3 font-medium text-gray-800 whitespace-nowrap">
                    {r.user.name}
                  </td>
                  <td className="p-3 text-gray-600">
                    <div className="text-gray-800">{r.checkpoint.name}</div>
                    <div className="text-xs text-gray-400">
                      {r.checkpoint.site.name}
                    </div>
                  </td>
                  <td className="p-3 text-gray-600 whitespace-nowrap">
                    {fmtDateTime(r.checkInAt)}
                  </td>
                  <td className="p-3 text-gray-600 whitespace-nowrap">
                    {r.submittedAt ? fmtDateTime(r.submittedAt) : "—"}
                  </td>
                  <td className="p-3 font-semibold text-brand-dark whitespace-nowrap">
                    {fmtDuration(r.checkInAt, r.submittedAt)}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <Link
                      href={`/inspector/${r.id}?from=reports`}
                      className="text-brand-dark font-medium hover:underline"
                    >
                      ดูรายละเอียด →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400">
        แสดงสูงสุด 300 รายการล่าสุด · งานที่ยังไม่ส่ง (กำลังทำงาน) จะไม่อยู่ในรายงานนี้
      </p>
    </div>
  );
}
