"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";

type Status = "loading" | "config" | "binding" | "error";

export default function LineLogin({ liffId }: { liffId: string }) {
  const [status, setStatus] = useState<Status>(liffId ? "loading" : "config");
  const [error, setError] = useState("");
  const [idToken, setIdToken] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!liffId || started.current) return;
    started.current = true;

    (async () => {
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId });

        if (!liff.isLoggedIn()) {
          liff.login(); // เด้งไปหน้าอนุญาตของ LINE แล้วกลับมาที่ /line
          return;
        }

        const token = liff.getIDToken();
        if (!token) {
          setError("ไม่ได้รับข้อมูลจาก LINE กรุณาลองใหม่");
          setStatus("error");
          return;
        }
        setIdToken(token);

        const res = await signIn("line", { idToken: token, redirect: false });
        if (res?.error) {
          // ยังไม่ผูกบัญชี → ให้ผูกด้วย username/password
          setStatus("binding");
          return;
        }
        window.location.href = "/"; // middleware จะพาไปหน้าตามบทบาท
      } catch {
        setError("เปิดผ่านแอป LINE เท่านั้น หรือยังตั้งค่า LIFF ไม่ถูกต้อง");
        setStatus("error");
      }
    })();
  }, [liffId]);

  async function bind(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/line/bind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "ผูกบัญชีไม่สำเร็จ");
        setSubmitting(false);
        return;
      }
      const login = await signIn("line", { idToken, redirect: false });
      if (login?.error) {
        setError("เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่");
        setSubmitting(false);
        return;
      }
      window.location.href = "/";
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
      setSubmitting(false);
    }
  }

  if (status === "config") {
    return (
      <p className="text-sm text-gray-500 text-center">
        ยังไม่ได้ตั้งค่า LINE (LIFF) — ผู้ดูแลระบบต้องใส่ <code>LIFF_ID</code> ก่อน
      </p>
    );
  }

  if (status === "loading") {
    return (
      <p className="text-center text-gray-400 text-sm">กำลังเชื่อมต่อ LINE…</p>
    );
  }

  if (status === "error") {
    return <p className="text-sm text-red-600 text-center">{error}</p>;
  }

  // status === "binding"
  return (
    <form onSubmit={bind} className="space-y-4">
      <p className="text-sm text-gray-600 text-center">
        เชื่อมบัญชี LINE กับพนักงานครั้งแรก — กรอกชื่อผู้ใช้/รหัสผ่านของระบบ
      </p>
      <div>
        <label className="label">ชื่อผู้ใช้</label>
        <input
          className="input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none"
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
          required
        />
      </div>
      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2.5">{error}</p>
      )}
      <button type="submit" className="btn-primary w-full" disabled={submitting}>
        {submitting ? "กำลังเชื่อมบัญชี…" : "เชื่อมบัญชีและเข้าสู่ระบบ"}
      </button>
    </form>
  );
}
