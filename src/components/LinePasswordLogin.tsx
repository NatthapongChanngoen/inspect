"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

type Status = "loading" | "form" | "error";

// ล็อกอินผู้ตรวจ/ผู้บริหาร/แอดมิน ผ่าน LINE (LIFF) พร้อม "ผูกบัญชี LINE" เหมือนแม่บ้าน
// - ถ้าบัญชี LINE ผูกไว้แล้ว → signIn("line") อัตโนมัติ (ไม่ต้องกรอกอะไร)
// - ถ้ายังไม่ผูก → กรอกชื่อ+รหัสผ่าน → ผูก lineUserId แล้วเข้าสู่ระบบ
// - ถ้าเปิดนอกแอป LINE (LIFF ใช้ไม่ได้) → กรอกชื่อ+รหัสผ่านเข้าระบบปกติ (ไม่ผูก)
export default function LinePasswordLogin({ liffId }: { liffId: string }) {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/";
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [idToken, setIdToken] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      try {
        if (!liffId) {
          // ยังไม่ได้ตั้ง LIFF → ให้กรอกรหัสผ่านเข้าระบบปกติ (ไม่ผูก LINE)
          setStatus("form");
          return;
        }
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId });

        if (!liff.isLoggedIn()) {
          liff.login(); // เด้งไปอนุญาต LINE แล้วกลับมา
          return;
        }

        const token = liff.getIDToken();
        if (token) {
          setIdToken(token);
          // ถ้าบัญชี LINE นี้ผูกไว้แล้ว → เข้าสู่ระบบอัตโนมัติ
          const res = await signIn("line", { idToken: token, redirect: false });
          if (!res?.error) {
            window.location.href = callbackUrl;
            return;
          }
        }
        // ยังไม่ผูก → ให้กรอกชื่อ+รหัสผ่านเพื่อผูกบัญชี
        setStatus("form");
      } catch {
        // เปิดนอกแอป LINE หรือ LIFF ใช้ไม่ได้ → กรอกรหัสผ่านเข้าระบบปกติ (ไม่ผูก)
        setStatus("form");
      }
    })();
  }, [liffId, callbackUrl]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      // ถ้ามี idToken → ผูกบัญชี LINE ก่อน (ยืนยันรหัสผ่านที่ฝั่ง server ด้วย)
      if (idToken) {
        const res = await fetch("/api/line/bind-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken, username, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "เข้าสู่ระบบไม่สำเร็จ");
          setSubmitting(false);
          return;
        }
      }
      // เข้าสู่ระบบด้วยชื่อ+รหัสผ่าน
      const login = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });
      if (login?.error) {
        setError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
        setSubmitting(false);
        return;
      }
      window.location.href = callbackUrl;
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
      setSubmitting(false);
    }
  }

  if (status === "loading") {
    return (
      <p className="text-center text-gray-400 text-sm">กำลังเชื่อมต่อ LINE…</p>
    );
  }

  if (status === "error") {
    return <p className="text-sm text-red-600 text-center">{error}</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {idToken && (
        <p className="text-xs text-gray-500 text-center">
          เข้าครั้งแรก — กรอกชื่อและรหัสผ่านเพื่อผูกบัญชี LINE ของคุณ
        </p>
      )}
      <div>
        <label className="label">ชื่อ</label>
        <input
          className="input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none"
          autoComplete="username"
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
          autoComplete="current-password"
          required
        />
      </div>
      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2.5">{error}</p>
      )}
      <button type="submit" className="btn-primary w-full" disabled={submitting}>
        {submitting ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
      </button>
    </form>
  );
}
