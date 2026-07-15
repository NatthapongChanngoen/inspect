import { Users, Brush, Shield, UserCheck } from "lucide-react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toggleUserActive, unbindLine } from "../actions";
import DeleteUserButton from "@/components/DeleteUserButton";
import AddUserModal from "@/components/AddUserModal";
import EditUserModal from "@/components/EditUserModal";
import UserFilters from "@/components/UserFilters";
import StatCard from "@/components/StatCard";

export const dynamic = "force-dynamic";

const roleLabel: Record<string, string> = {
  STAFF: "พนักงาน",
  INSPECTOR: "ผู้ตรวจสอบ",
  ADMIN: "ผู้ดูแลระบบ",
  EXECUTIVE: "ผู้บริหาร",
};

const staffTypeLabel: Record<string, string> = {
  HOUSEKEEPER: "แม่บ้าน",
  SECURITY: "รปภ.",
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; staffType?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const fRole = sp.role || "";
  const fStaffType = sp.staffType || "";

  const where: Prisma.UserWhereInput = {};
  if (
    fRole === "STAFF" ||
    fRole === "INSPECTOR" ||
    fRole === "ADMIN" ||
    fRole === "EXECUTIVE"
  )
    where.role = fRole;
  if (fStaffType === "HOUSEKEEPER" || fStaffType === "SECURITY")
    where.staffType = fStaffType;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { username: { contains: q, mode: "insensitive" } },
      { nationalId: { contains: q } },
    ];
  }

  const [users, roleGroups, typeGroups, departments] = await Promise.all([
    prisma.user.findMany({ where, orderBy: { createdAt: "asc" } }),
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.user.groupBy({ by: ["staffType"], _count: { _all: true } }),
    prisma.department.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const deptName = new Map(departments.map((d) => [d.id, d.name]));

  const total = roleGroups.reduce((a, g) => a + g._count._all, 0);
  const inspectorCount =
    roleGroups.find((g) => g.role === "INSPECTOR")?._count._all ?? 0;
  const housekeeperCount =
    typeGroups.find((g) => g.staffType === "HOUSEKEEPER")?._count._all ?? 0;
  const securityCount =
    typeGroups.find((g) => g.staffType === "SECURITY")?._count._all ?? 0;

  // ลิงก์การ์ดสรุป → กรองรายการ (คง q เดิม)
  function cardHref(next: { role?: string; staffType?: string }): string {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (next.role) params.set("role", next.role);
    if (next.staffType) params.set("staffType", next.staffType);
    const qs = params.toString();
    return qs ? `/admin/users?${qs}` : "/admin/users";
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">ผู้ใช้งาน</h1>
        <AddUserModal departments={departments} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="สมาชิกทั้งหมด"
          value={total}
          icon={Users}
          accent="blue"
          href={cardHref({})}
          active={!fRole && !fStaffType}
        />
        <StatCard
          label="แม่บ้าน"
          value={housekeeperCount}
          icon={Brush}
          accent="emerald"
          href={cardHref({ staffType: "HOUSEKEEPER" })}
          active={fStaffType === "HOUSEKEEPER"}
        />
        <StatCard
          label="รปภ."
          value={securityCount}
          icon={Shield}
          accent="amber"
          href={cardHref({ staffType: "SECURITY" })}
          active={fStaffType === "SECURITY"}
        />
        <StatCard
          label="ผู้ตรวจ"
          value={inspectorCount}
          icon={UserCheck}
          accent="gray"
          href={cardHref({ role: "INSPECTOR" })}
          active={fRole === "INSPECTOR"}
        />
      </div>

      <UserFilters q={q} role={fRole} staffType={fStaffType} />

      <div className="card divide-y">
        {users.length === 0 && (
          <div className="p-4 text-center text-gray-400 text-sm">
            ไม่พบผู้ใช้ตามเงื่อนไข
          </div>
        )}
        {users.map((u) => (
          <div key={u.id} className="p-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-medium">
                {u.name}{" "}
                {!u.active && (
                  <span className="badge bg-gray-200 text-gray-600 ml-1">ปิดใช้งาน</span>
                )}
              </div>
              <div className="text-sm text-gray-500">
                @{u.username} · {roleLabel[u.role]}
                {u.role === "STAFF" && u.staffType
                  ? ` · ${staffTypeLabel[u.staffType]}`
                  : ""}
                {u.phone ? ` · ${u.phone}` : ""}
                {u.departmentId && deptName.get(u.departmentId)
                  ? ` · ฝ่าย ${deptName.get(u.departmentId)}`
                  : ""}
                {u.nationalId ? ` · บัตร ปชช. ${u.nationalId}` : ""}
                {u.lineUserId ? " · 🟢 LINE" : ""}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <EditUserModal
                departments={departments}
                user={{
                  id: u.id,
                  name: u.name,
                  username: u.username,
                  phone: u.phone,
                  nationalId: u.nationalId,
                  role: u.role,
                  staffType: u.staffType,
                  departmentId: u.departmentId,
                }}
              />
              {u.lineUserId && (
                <form action={unbindLine}>
                  <input type="hidden" name="id" value={u.id} />
                  <button className="btn-ghost !py-1.5 text-sm">ปลด LINE</button>
                </form>
              )}
              <form action={toggleUserActive}>
                <input type="hidden" name="id" value={u.id} />
                <button className="btn-ghost !py-1.5 text-sm">
                  {u.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                </button>
              </form>
              <DeleteUserButton id={u.id} name={u.name} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
