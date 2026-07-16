import AdminNav from "@/components/AdminNav";
import AdminTopbar from "@/components/AdminTopbar";
import { currentUser } from "@/lib/session";

// /issues ใช้ร่วมกันหลายบทบาท:
//   EXECUTIVE = แดชบอร์ดข้อเสนอ · ADMIN = รายการทั้งหมด
//   สมาชิกฝ่าย = รายการของฝ่าย · แม่บ้าน/รปภ = รายการที่ตัวเองแจ้ง (ลิงก์มาจาก /staff)
// → ใส่ shell ของแอดมินเฉพาะ ADMIN/EXECUTIVE เท่านั้น ไม่งั้นพนักงานจะเห็นเมนูแอดมิน
export default async function IssuesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  const withShell = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  if (!withShell) return <>{children}</>;

  return (
    <div className="md:flex min-h-screen">
      <AdminNav role={user.role} />
      <div className="flex-1 min-w-0 flex flex-col">
        <AdminTopbar name={user.name} role={user.role} />
        <main className="flex-1 min-w-0 p-4 md:p-6 max-w-6xl w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
