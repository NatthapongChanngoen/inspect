import Link from "next/link";
import { CheckIcon } from "@/components/Icons";

export default function LandingFooter() {
  return (
    <footer id="about" className="bg-gray-50 border-t border-gray-100">
      <div className="max-w-6xl mx-auto px-4 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 font-bold text-gray-800">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand text-white">
            <CheckIcon size={18} />
          </span>
          ระบบตรวจงาน แม่บ้าน/รปภ.
        </div>

        <nav className="flex gap-5 text-sm text-gray-500">
          <a href="#features" className="hover:text-brand-dark">
            ฟีเจอร์
          </a>
          <Link href="/login" className="hover:text-brand-dark">
            เข้าสู่ระบบ
          </Link>
          <Link href="/register" className="hover:text-brand-dark">
            สมัครสมาชิก
          </Link>
        </nav>

        <p className="text-xs text-gray-400">
          © 2026 ระบบตรวจงาน · ใช้ภายในองค์กร
        </p>
      </div>
    </footer>
  );
}
