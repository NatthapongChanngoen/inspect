"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, password, phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "สมัครไม่สำเร็จ");
        setLoading(false);
        return;
      }
      // สมัครสำเร็จ → เข้าสู่ระบบอัตโนมัติ
      const login = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });
      setLoading(false);
      if (login?.error) {
        router.replace("/login");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label">ชื่อ-นามสกุล</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="label">ชื่อผู้ใช้ (สำหรับล็อกอิน)</label>
        <input
          className="input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none"
          autoComplete="username"
          placeholder="a-z, 0-9, _ . อย่างน้อย 3 ตัว"
          required
        />
      </div>
      <div>
        <label className="label">รหัสผ่าน</label>
        <input
          className="input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          placeholder="อย่างน้อย 6 ตัว"
          required
        />
      </div>
      <div>
        <label className="label">เบอร์โทร (ไม่บังคับ)</label>
        <input
          className="input"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2.5">{error}</p>
      )}

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? "กำลังสมัคร…" : "สมัครสมาชิก (พนักงาน)"}
      </button>

      <p className="text-center text-sm text-gray-500">
        มีบัญชีอยู่แล้ว?{" "}
        <Link href="/login" className="text-brand-dark font-semibold">
          เข้าสู่ระบบ
        </Link>
      </p>
    </form>
  );
}
