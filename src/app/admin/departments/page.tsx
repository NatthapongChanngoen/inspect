import { prisma } from "@/lib/db";
import { createDepartment } from "../actions";
import DepartmentManager from "@/components/DepartmentManager";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  const departments = await prisma.department.findMany({
    include: { _count: { select: { checkpoints: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">ฝ่าย</h1>

      <form action={createDepartment} className="card p-4 space-y-3">
        <div className="font-semibold">เพิ่มฝ่ายใหม่</div>
        <div>
          <label className="label">ชื่อฝ่าย</label>
          <input
            name="name"
            className="input"
            required
            placeholder="เช่น ฝ่ายแม่บ้าน"
          />
        </div>
        <button className="btn-primary">เพิ่มฝ่าย</button>
      </form>

      <DepartmentManager
        departments={departments.map((d) => ({
          id: d.id,
          name: d.name,
          active: d.active,
          checkpointCount: d._count.checkpoints,
        }))}
      />
    </div>
  );
}
