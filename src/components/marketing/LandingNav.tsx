import Link from "next/link";
import { CheckIcon } from "@/components/Icons";

export default function LandingNav() {
  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-lg text-gray-900"
        >
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-brand text-white">
            <CheckIcon size={20} />
          </span>
          ระบบตรวจงาน
        </Link>

        <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-gray-600">
          <a href="#features" className="hover:text-brand-dark">
            ฟีเจอร์
          </a>
          <a href="#about" className="hover:text-brand-dark">
            เกี่ยวกับ
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost !py-2 text-sm">
            เข้าสู่ระบบ
          </Link>
          <Link href="/register" className="btn-primary !py-2 text-sm">
            สมัครสมาชิก
          </Link>
        </div>
      </div>
    </header>
  );
}
