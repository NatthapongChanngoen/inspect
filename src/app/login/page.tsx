import { Suspense } from "react";
import Link from "next/link";
import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-sm p-7 sm:p-8">
        <div className="flex flex-col items-center mb-7">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-light to-brand-dark flex items-center justify-center mb-4 shadow-lg shadow-brand/30">
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ระบบตรวจงาน</h1>
          <p className="text-sm text-gray-500 mt-0.5">แม่บ้าน / รปภ.</p>
        </div>

        {/* เข้าสู่ระบบด้วย LINE (เปิดผ่านแอป LINE จะล็อกอินอัตโนมัติ) */}
        <Link
          href="/line"
          className="btn w-full text-white mb-4"
          style={{ backgroundColor: "#06C755" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2C6.48 2 2 5.69 2 10.23c0 4.07 3.55 7.48 8.34 8.13.32.07.77.21.88.49.1.25.07.64.03.9l-.14.86c-.04.25-.2.99.87.54 1.07-.45 5.75-3.39 7.85-5.8C21.36 13.74 22 12.06 22 10.23 22 5.69 17.52 2 12 2Z" />
          </svg>
          เข้าสู่ระบบด้วย LINE
        </Link>

        <div className="flex items-center gap-3 mb-4">
          <span className="h-px flex-1 bg-gray-200" />
          <span className="text-xs text-gray-400">หรือ</span>
          <span className="h-px flex-1 bg-gray-200" />
        </div>

        <Suspense fallback={<div className="text-center text-gray-400">กำลังโหลด…</div>}>
          <LoginForm />
        </Suspense>

        <p className="text-center text-sm text-gray-500 mt-6">
          ยังไม่มีบัญชี?{" "}
          <Link href="/register" className="text-brand-dark font-semibold">
            สมัครสมาชิก
          </Link>
        </p>
      </div>
    </div>
  );
}
