import { prisma } from "@/lib/db";
import AssignmentTabs from "@/components/AssignmentTabs";

export const dynamic = "force-dynamic";

export default async function AssignmentsPage() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [staff, checkpoints, assignments, schedules] = await Promise.all([
    prisma.user.findMany({
      where: { role: "STAFF", active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, staffType: true },
    }),
    prisma.checkpoint.findMany({
      where: { active: true },
      include: { site: true, department: true },
      orderBy: { name: "asc" },
    }),
    prisma.assignment.findMany({
      where: { scheduledDate: { gte: todayStart } },
      include: {
        user: true,
        checkpoint: { include: { site: true, department: true } },
      },
      orderBy: [{ scheduledDate: "asc" }, { createdAt: "asc" }],
    }),
    prisma.schedule.findMany({
      include: {
        user: true,
        checkpoint: { include: { site: true, department: true } },
      },
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

      {noBasics ? (
        <div className="card p-4 text-sm text-gray-500">
          ต้องมีพนักงาน (บทบาทพนักงาน) และจุดเช็คอินอย่างน้อยอย่างละ 1 ก่อน
        </div>
      ) : (
        <AssignmentTabs
          staff={staff}
          checkpoints={checkpoints}
          schedules={schedules}
          defaultDate={todayStr}
          assignments={assignments}
        />
      )}
    </div>
  );
}
