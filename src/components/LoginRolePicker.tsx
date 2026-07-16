"use client";

import { useState } from "react";
import Link from "next/link";
import LoginForm from "@/components/LoginForm";

type Mode = "pick" | "password";

// ไอคอน LINE (สำหรับปุ่มแม่บ้าน/รปภ)
function LineIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 5.69 2 10.23c0 4.07 3.55 7.48 8.34 8.13.32.07.77.21.88.49.1.25.07.64.03.9l-.14.86c-.04.25-.2.99.87.54 1.07-.45 5.75-3.39 7.85-5.8C21.36 13.74 22 12.06 22 10.23 22 5.69 17.52 2 12 2Z" />
    </svg>
  );
}

export default function LoginRolePicker() {
  const [mode, setMode] = useState<Mode>("pick");

  if (mode === "password") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600 text-center">
          ผู้ตรวจ / ผู้บริหาร — เข้าสู่ระบบด้วยชื่อและรหัสผ่าน
        </p>
        <LoginForm />
        <button
          type="button"
          onClick={() => setMode("pick")}
          className="btn w-full text-gray-600 border border-gray-200 bg-white"
        >
          ← เลือกบทบาทอื่น
        </button>
      </div>
    );
  }

  // mode === "pick"
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500 text-center mb-1">
        เลือกบทบาทของคุณเพื่อเข้าสู่ระบบ
      </p>

      {/* แม่บ้าน / รปภ → เข้าผ่าน LINE (ยืนยัน ชื่อ + เลขบัตรประชาชน) */}
      <Link
        href="/line?role=housekeeper"
        className="btn w-full text-white gap-2"
        style={{ backgroundColor: "#06C755" }}
      >
        <LineIcon />
        🧹 แม่บ้าน — เข้าสู่ระบบ
      </Link>
      <Link
        href="/line?role=security"
        className="btn w-full text-white gap-2"
        style={{ backgroundColor: "#06C755" }}
      >
        <LineIcon />
        🛡️ รปภ. — เข้าสู่ระบบ
      </Link>

      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-gray-200" />
        <span className="text-xs text-gray-400">หรือ</span>
        <span className="h-px flex-1 bg-gray-200" />
      </div>

      {/* ผู้ตรวจ / ผู้สั่งงาน / ผู้บริหาร → ฟอร์มรหัสผ่าน (ทุกปุ่มเปิดฟอร์มเดียวกัน — เป็นแค่ตัวนำทาง) */}
      <button
        type="button"
        onClick={() => setMode("password")}
        className="btn w-full text-white"
        style={{ backgroundColor: "#3b82f6" }}
      >
        ✅ ผู้ตรวจ — เข้าสู่ระบบ
      </button>
      <button
        type="button"
        onClick={() => setMode("password")}
        className="btn w-full text-white"
        style={{ backgroundColor: "#3b82f6" }}
      >
        📋 ผู้สั่งงาน — เข้าสู่ระบบ
      </button>
      <button
        type="button"
        onClick={() => setMode("password")}
        className="btn w-full text-white"
        style={{ backgroundColor: "#3b82f6" }}
      >
        📊 ผู้บริหาร — เข้าสู่ระบบ
      </button>

      <div className="text-center pt-1">
        <button
          type="button"
          onClick={() => setMode("password")}
          className="text-xs text-gray-400 hover:text-gray-600 underline"
        >
          เข้าสู่ระบบผู้ดูแลระบบ
        </button>
      </div>
    </div>
  );
}
