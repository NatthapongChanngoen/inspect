import LineLogin from "@/components/LineLogin";

export const dynamic = "force-dynamic";

// หน้าเข้าระบบผ่าน LINE (LIFF) — อ่าน LIFF_ID ฝั่ง server ส่งให้ client
export default function LinePage() {
  const liffId = process.env.LIFF_ID || "";
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-sm p-7">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-brand-light to-brand-dark flex items-center justify-center mb-3 shadow-lg shadow-brand/30">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">ระบบตรวจงาน</h1>
          <p className="text-sm text-gray-500 mt-0.5">เข้าสู่ระบบผ่าน LINE</p>
        </div>

        <LineLogin liffId={liffId} />
      </div>
    </div>
  );
}
