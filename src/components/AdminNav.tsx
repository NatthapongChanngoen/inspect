"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GridIcon,
  BuildingIcon,
  MapPinIcon,
  ClipboardIcon,
  AlertTriangleIcon,
  UsersIcon,
  ClockIcon,
} from "@/components/Icons";

const tabs = [
  { href: "/admin", label: "แดชบอร์ด", icon: GridIcon },
  { href: "/admin/sites", label: "สถานที่", icon: BuildingIcon },
  { href: "/admin/checkpoints", label: "จุดเช็คอิน", icon: MapPinIcon },
  { href: "/admin/assignments", label: "มอบหมายงาน", icon: ClipboardIcon },
  { href: "/admin/reports", label: "รายงานเวลา", icon: ClockIcon },
  { href: "/admin/suspicious", label: "น่าสงสัย", icon: AlertTriangleIcon },
  { href: "/admin/users", label: "ผู้ใช้", icon: UsersIcon },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="bg-white border-b border-gray-200 md:border-b-0 md:border-r md:w-52 md:shrink-0 sticky top-[56px] z-10 md:self-start md:h-[calc(100vh-56px)] md:overflow-y-auto">
      <div className="flex md:flex-col gap-1 p-2 overflow-x-auto">
        {tabs.map((t) => {
          const active =
            t.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(t.href);
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                active
                  ? "bg-brand text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Icon size={18} className="shrink-0" />
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
