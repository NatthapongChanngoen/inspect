import { Suspense } from "react";
import LoginRolePicker from "@/components/LoginRolePicker";

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
          <p className="text-sm text-gray-500 mt-0.5">เลือกบทบาทเพื่อเข้าสู่ระบบ</p>
        </div>

        <Suspense fallback={<div className="text-center text-gray-400">กำลังโหลด…</div>}>
          <LoginRolePicker />
        </Suspense>
      </div>
    </div>
  );
}
