import Link from "next/link";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import { ROLE_LABELS as roleLabel, homeFor } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const me = await currentUser();
  if (!me) return null;
  const user = await prisma.user.findUnique({ where: { id: me.id } });
  if (!user) return null;

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <Link href={homeFor(user.role)} className="text-sm text-gray-500">
        ← กลับ
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">โปรไฟล์</h1>
        <p className="text-sm text-gray-500 mt-0.5">ข้อมูลบัญชีของคุณ</p>
      </div>

      <div className="card p-4 text-sm space-y-1.5 text-gray-700">
        <div>
          <span className="text-gray-500">ชื่อ:</span> {user.name}
        </div>
        <div>
          <span className="text-gray-500">ชื่อผู้ใช้:</span> @{user.username}
        </div>
        <div>
          <span className="text-gray-500">บทบาท:</span>{" "}
          {roleLabel[user.role] ?? user.role}
        </div>
        {user.phone && (
          <div>
            <span className="text-gray-500">เบอร์โทร:</span> {user.phone}
          </div>
        )}
        {user.nationalId && (
          <div>
            <span className="text-gray-500">เลขบัตร ปชช.:</span> {user.nationalId}
          </div>
        )}
        <div>
          <span className="text-gray-500">LINE:</span>{" "}
          {user.lineUserId ? "🟢 ผูกแล้ว" : "ยังไม่ได้ผูก"}
        </div>
      </div>

      <ChangePasswordForm />
    </div>
  );
}
