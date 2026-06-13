"use client";

import { signOut } from "next-auth/react";
import { LogoutIcon } from "./Icons";

export default function LogoutButton() {
  async function handleLogout() {
    // ออกจากระบบแล้วพาไปหน้าเข้าสู่ระบบทันที (hard redirect ให้ชัวร์)
    await signOut({ redirect: false });
    window.location.href = "/login";
  }

  return (
    <button
      onClick={handleLogout}
      className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/25"
      title="ออกจากระบบ"
    >
      <LogoutIcon size={16} />
      <span className="hidden sm:inline">ออกจากระบบ</span>
    </button>
  );
}
