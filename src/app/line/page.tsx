import { Suspense } from "react";
import LineLogin from "@/components/LineLogin";
import LinePasswordLogin from "@/components/LinePasswordLogin";
import PublicIssueForm from "@/components/PublicIssueForm";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// หน้าเข้าระบบผ่าน LINE (LIFF) — อ่าน LIFF_ID ฝั่ง server ส่งให้ client
// ?to=report → ช่องทาง "แจ้งซ่อม" สาธารณะ (ไม่ต้องผูกบัญชี)
// ?role=inspector|executive → ฟอร์มชื่อ+รหัสผ่าน (เปิดในแอป LINE เหมือนกัน) · อื่น ๆ → เชื่อมบัญชี LINE
export default async function LinePage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string; role?: string }>;
}) {
  const liffId = process.env.LIFF_ID || "";
  const { to, role } = await searchParams;
  const isReport = to === "report";
  // ผู้ตรวจ/ผู้บริหาร/แอดมิน ใช้รหัสผ่าน — เปิดในแอป LINE แต่กรอกชื่อ+รหัส
  const isPasswordRole =
    role === "inspector" || role === "executive" || role === "admin";

  // หัวข้อตามบทบาทที่เลือกมา — มีผลแค่ข้อความ ไม่กระทบ flow ยืนยันตัวตน
  const roleTitle =
    role === "housekeeper"
      ? "เข้าสู่ระบบแม่บ้าน"
      : role === "security"
        ? "เข้าสู่ระบบ รปภ."
        : role === "inspector"
          ? "เข้าสู่ระบบผู้ตรวจ"
          : role === "executive"
            ? "เข้าสู่ระบบผู้บริหาร"
            : role === "admin"
              ? "เข้าสู่ระบบผู้ดูแลระบบ"
              : "ระบบตรวจงาน";

  const checkpoints = isReport
    ? await prisma.checkpoint.findMany({
        where: { active: true },
        select: { id: true, name: true, site: { select: { name: true } } },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-sm p-7">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-brand-light to-brand-dark flex items-center justify-center mb-3 shadow-lg shadow-brand/30">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            {isReport ? "แจ้งซ่อม / แจ้งปัญหา" : roleTitle}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isReport
              ? "แจ้งผ่าน LINE ได้ทันที"
              : isPasswordRole
                ? "กรอกชื่อและรหัสผ่าน"
                : "เข้าสู่ระบบผ่าน LINE"}
          </p>
        </div>

        {isReport ? (
          <PublicIssueForm liffId={liffId} checkpoints={checkpoints} />
        ) : isPasswordRole ? (
          <Suspense fallback={<div className="text-center text-gray-400">กำลังโหลด…</div>}>
            <LinePasswordLogin liffId={liffId} />
          </Suspense>
        ) : (
          <LineLogin liffId={liffId} />
        )}
      </div>
    </div>
  );
}
