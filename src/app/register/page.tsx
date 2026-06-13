import RegisterForm from "@/components/RegisterForm";

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-sm p-7 sm:p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-brand-light to-brand-dark flex items-center justify-center mb-3 shadow-lg shadow-brand/30">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M19 8v6M22 11h-6" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">สมัครสมาชิก</h1>
          <p className="text-sm text-gray-500 mt-0.5">สำหรับพนักงาน แม่บ้าน / รปภ.</p>
        </div>

        <RegisterForm />
      </div>
    </div>
  );
}
