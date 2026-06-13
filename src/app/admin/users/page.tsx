import { prisma } from "@/lib/db";
import { createUser, toggleUserActive, resetPassword } from "../actions";
import DeleteUserButton from "@/components/DeleteUserButton";

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
      <h1 className="text-xl font-bold">ผู้ใช้งาน</h1>

      <form action={createUser} className="card p-4 space-y-3">
        <div className="font-semibold">เพิ่มผู้ใช้ใหม่</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">ชื่อ-นามสกุล</label>
            <input name="name" className="input" required />
          </div>
          <div>
            <label className="label">ชื่อผู้ใช้ (สำหรับล็อกอิน)</label>
            <input name="username" className="input" autoCapitalize="none" required />
          </div>
          <div>
            <label className="label">รหัสผ่าน</label>
            <input name="password" className="input" required />
          </div>
          <div>
            <label className="label">เบอร์โทร</label>
            <input name="phone" className="input" />
          </div>
          <div>
            <label className="label">บทบาท</label>
            <select name="role" className="input" defaultValue="STAFF">
              <option value="STAFF">พนักงาน (แม่บ้าน/รปภ)</option>
              <option value="INSPECTOR">ผู้ตรวจสอบ</option>
              <option value="ADMIN">ผู้ดูแลระบบ</option>
            </select>
          </div>
        </div>
        <button className="btn-primary">เพิ่มผู้ใช้</button>
      </form>

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
