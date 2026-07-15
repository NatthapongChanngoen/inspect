"use client";

import { signOut } from "next-auth/react";
import { LogoutIcon } from "./Icons";

export default function LogoutButton({
  variant = "light",
}: {
  // light = ใช้บนแถบสีเข้ม (Header), dark = ใช้บนพื้นขาว (Admin topbar)
  variant?: "light" | "dark";
}) {
  async function handleLogout() {
    // ออกจากระบบแล้วพาไปหน้าเข้าสู่ระบบทันที (hard redirect ให้ชัวร์)
    await signOut({ redirect: false });
    window.location.href = "/login";
  }

  const cls =
    variant === "dark"
      ? "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
      : "bg-white/15 text-white hover:bg-white/25";

  return (
    <button
      onClick={handleLogout}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${cls}`}
      title="ออกจากระบบ"
    >
      <LogoutIcon size={16} />
      <span className="hidden sm:inline">ออกจากระบบ</span>
    </button>
  );
}
