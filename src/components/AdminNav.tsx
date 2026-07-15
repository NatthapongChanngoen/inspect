"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GridIcon,
  BuildingIcon,
  MapPinIcon,
  ClipboardIcon,
  UsersIcon,
  CheckIcon,
  WrenchIcon,
  ClipboardCheckIcon,
  TagIcon,
  ChartIcon,
} from "@/components/Icons";

type Item = { href: string; label: string; icon: typeof GridIcon };

const groups: { title: string; items: Item[] }[] = [
  {
    title: "ภาพรวม",
    items: [
      { href: "/admin", label: "แดชบอร์ด", icon: GridIcon },
      { href: "/admin/executive", label: "รายงานผู้บริหาร", icon: ChartIcon },
    ],
  },
  {
    title: "ข้อมูลหลัก",
    items: [
      { href: "/admin/sites", label: "สถานที่", icon: BuildingIcon },
      { href: "/admin/departments", label: "ฝ่าย", icon: TagIcon },
      { href: "/admin/checkpoints", label: "จุดเช็คอิน", icon: MapPinIcon },
      { href: "/admin/users", label: "ผู้ใช้", icon: UsersIcon },
    ],
  },
  {
    title: "งาน",
    items: [
      { href: "/inspector", label: "คิวตรวจ", icon: ClipboardCheckIcon },
      { href: "/admin/assignments", label: "มอบหมายงาน", icon: ClipboardIcon },
      { href: "/admin/repairs", label: "แดชบอร์ดงานซ่อม", icon: ChartIcon },
      { href: "/admin/issues", label: "แจ้งซ่อม/ของหมด", icon: WrenchIcon },
      { href: "/issues", label: "งานซ่อม (ข้อเสนอ)", icon: WrenchIcon },
    ],
  },
];

function useActive() {
  const pathname = usePathname();
  return (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

// ผู้บริหารเห็นเฉพาะรายงาน
const EXEC_ALLOWED = new Set(["/admin/executive", "/admin/repairs", "/issues"]);

export default function AdminNav({ role }: { role?: string }) {
  const isActive = useActive();

  const visibleGroups =
    role === "EXECUTIVE"
      ? groups
          .map((g) => ({
            ...g,
            items: g.items.filter((it) => EXEC_ALLOWED.has(it.href)),
          }))
          .filter((g) => g.items.length > 0)
      : groups;

  return (
    <>
      {/* ===== Sidebar (เดสก์ท็อป) ===== */}
      <aside className="hidden md:flex md:flex-col md:w-60 md:shrink-0 md:sticky md:top-0 md:h-screen bg-white border-r border-gray-200">
        <Link
          href="/admin"
          className="flex items-center gap-2 px-4 h-14 border-b border-gray-100 shrink-0"
        >
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand text-white">
            <CheckIcon size={18} />
          </span>
          <span className="font-bold text-gray-800">ระบบตรวจงาน</span>
        </Link>

        <nav className="flex flex-col gap-5 p-3 overflow-y-auto flex-1">
          {visibleGroups.map((g) => (
            <div key={g.title}>
              <div className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                {g.title}
              </div>
              <div className="flex flex-col gap-0.5">
                {g.items.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                        active
                          ? "bg-brand/10 text-brand-dark"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <Icon size={18} className="shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* ===== แถบเมนูแนวนอน (มือถือ) ===== */}
      <nav className="md:hidden flex gap-1 p-2 overflow-x-auto bg-white border-b border-gray-200">
        {visibleGroups.flatMap((g) => g.items).map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                active
                  ? "bg-brand/10 text-brand-dark"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Icon size={18} className="shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
