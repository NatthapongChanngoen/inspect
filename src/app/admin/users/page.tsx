import { prisma } from "@/lib/db";
import { toggleUserActive, resetPassword } from "../actions";
import DeleteUserButton from "@/components/DeleteUserButton";
import AddUserModal from "@/components/AddUserModal";

export const dynamic = "force-dynamic";

const roleLabel: Record<string, string> = {
  STAFF: "พนักงาน",
  INSPECTOR: "ผู้ตรวจสอบ",
  ADMIN: "ผู้ดูแลระบบ",
};

export default async function UsersPage() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">ผู้ใช้งาน</h1>
        <AddUserModal />
      </div>

      <div className="card divide-y">
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
                @{u.username} · {roleLabel[u.role]} {u.phone ? `· ${u.phone}` : ""}
                {u.nationalId ? ` · บัตร ปชช. ${u.nationalId}` : ""}
                {u.lineUserId ? " · 🟢 LINE" : ""}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <form action={resetPassword} className="flex items-center gap-1">
                <input type="hidden" name="id" value={u.id} />
                <input
                  name="password"
                  placeholder="รหัสใหม่"
                  className="input !py-1.5 !w-28 text-sm"
                />
                <button className="btn-ghost !py-1.5 text-sm">รีเซ็ต</button>
              </form>
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
