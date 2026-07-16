"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User } from "lucide-react";
import LogoutButton from "./LogoutButton";
import { ROLE_LABELS as roleLabel } from "@/lib/permissions";

const titles: { prefix: string; label: string }[] = [
  { prefix: "/admin/sites", label: "สถานที่" },
  { prefix: "/admin/departments", label: "ฝ่าย" },
  { prefix: "/admin/checkpoints", label: "จุดเช็คอิน" },
  { prefix: "/admin/users", label: "ผู้ใช้" },
  { prefix: "/admin/assignments", label: "มอบหมายงาน" },
  { prefix: "/admin/reports", label: "รายงานเวลา" },
  { prefix: "/admin/issues", label: "แจ้งซ่อม/ของหมด" },
  { prefix: "/admin/repairs", label: "แดชบอร์ดงานซ่อม" },
  { prefix: "/admin/executive", label: "รายงานผู้บริหาร" },
  { prefix: "/admin/suspicious", label: "งานน่าสงสัย" },
  { prefix: "/admin", label: "แดชบอร์ด" }, // catch-all ของ /admin — ต้องอยู่ท้ายสุด
  { prefix: "/issues", label: "งานซ่อม (ข้อเสนอ)" },
];

export default function AdminTopbar({
  name,
  role,
}: {
  name?: string | null;
  role: string;
}) {
  const pathname = usePathname();
  const current = titles.find((t) => pathname.startsWith(t.prefix))?.label ?? "";

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-200">
      <div className="h-14 px-4 md:px-6 flex items-center justify-between gap-3">
        {/* breadcrumb */}
        <div className="min-w-0 flex items-center gap-1.5 text-sm">
          <span className="text-gray-400 shrink-0">ระบบตรวจงาน</span>
          <span className="text-gray-300">/</span>
          <span className="font-semibold text-gray-800 truncate">{current}</span>
        </div>

        {/* user + logout */}
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/profile"
            className="flex items-center gap-2.5 hover:opacity-80"
          >
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-brand/10 text-brand-dark">
              <User size={18} />
            </span>
            <div className="leading-tight hidden sm:block">
              <div className="text-sm font-medium text-gray-800">{name}</div>
              <div className="text-xs text-gray-400">
                {roleLabel[role] ?? role}
              </div>
            </div>
          </Link>
          <LogoutButton variant="dark" />
        </div>
      </div>
    </header>
  );
}
