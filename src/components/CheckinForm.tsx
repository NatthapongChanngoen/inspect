"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QrScanner from "./QrScanner";
import PhotoInput from "./PhotoInput";

export default function CheckinForm({
  checkpointId,
}: {
  checkpointId: string;
}) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [verifyPhoto, setVerifyPhoto] = useState<File | null>(null);
  const [before, setBefore] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // ขั้นตอน: สแกน QR → ถ่ายรูปยืนยันจุด → ถ่ายรูปก่อนเริ่มงาน (แยกหน้า)
  const [step, setStep] = useState<"scan" | "verify" | "before">("scan");

  // ตรวจว่ากำลังเปิดผ่านแอป LINE หรือไม่ (จาก user-agent) — บังคับเฉพาะตอนสแกน QR
  const [liffChecked, setLiffChecked] = useState(false);
  const [inLiff, setInLiff] = useState(false);

  useEffect(() => {
    setInLiff(/Line\//i.test(navigator.userAgent));
    setLiffChecked(true);
  }, []);

  const ready = inLiff && !!token && !!verifyPhoto && !!before;

  async function submit() {
    if (!ready || !token || !verifyPhoto || !before) return;
    setError("");
    setSubmitting(true);
    try {
      const sRes = await fetch("/api/checkin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkpointId }),
      });
      const sData = await sRes.json();
      if (!sRes.ok) {
        setError(sData.error || "เริ่มเซสชันไม่สำเร็จ");
        setSubmitting(false);
        return;
      }

      const fd = new FormData();
      fd.set("checkpointId", checkpointId);
      fd.set("nonce", sData.nonce);
      fd.set("token", token);
      fd.set("verifyPhoto", verifyPhoto);
      fd.set("before", before);

      const res = await fetch("/api/checkin", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.id) {
          router.push(`/staff/work/${data.id}`);
          return;
        }
        setError(data.error || "เช็คอินไม่สำเร็จ");
        setSubmitting(false);
        return;
      }
      router.push(`/staff/work/${data.id}`);
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {step === "scan" && (
        <div className="card p-4">
          <div className="font-semibold mb-2">สแกน QR ที่จุดทำงาน</div>
          {!liffChecked ? (
            <p className="text-sm text-gray-400">กำลังตรวจสอบ…</p>
          ) : !inLiff ? (
            <div className="flex items-start gap-2 text-amber-800 bg-amber-50 rounded-lg p-3 text-sm">
              <span>📱</span>
              <span>
                สแกน QR ได้เฉพาะเมื่อเปิดหน้านี้ผ่าน<b>แอป LINE</b> เท่านั้น —
                กรุณากดปุ่ม “เริ่มงาน” จาก LINE OA ของบริษัท
              </span>
            </div>
          ) : (
            <QrScanner
              onResult={(t) => {
                setToken(t);
                setStep("verify");
              }}
              done={!!token}
            />
          )}
        </div>
      )}

      {step === "verify" && (
        <div className="space-y-4">
          <button
            type="button"
            className="text-sm text-gray-500"
            onClick={() => {
              setStep("scan");
              setToken(null);
              setVerifyPhoto(null);
              setBefore(null);
            }}
          >
            ← สแกน QR ใหม่
          </button>

          <div className="card p-4">
            <div className="font-semibold mb-2">1. ถ่ายรูปยืนยันที่จุดทำงาน</div>
            <p className="text-sm text-gray-500 mb-2">
              ถ่ายรูปเป็นหลักฐานว่าอยู่ที่จุดจริง (ผู้ตรวจจะเห็นรูปนี้)
            </p>
            <PhotoInput label="" onChange={setVerifyPhoto} />
          </div>

          <button
            className="btn-primary w-full"
            disabled={!verifyPhoto}
            onClick={() => setStep("before")}
          >
            ถัดไป
          </button>
        </div>
      )}

      {step === "before" && (
        <div className="space-y-4">
          <button
            type="button"
            className="text-sm text-gray-500"
            onClick={() => setStep("verify")}
          >
            ← ย้อนกลับ
          </button>

          <div className="card p-4">
            <div className="font-semibold mb-2">2. ถ่ายรูปก่อนเริ่มงาน</div>
            <p className="text-sm text-gray-500 mb-2">
              ถ่ายสภาพจุดก่อนลงมือทำงาน
            </p>
            <PhotoInput label="" onChange={setBefore} />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>
          )}

          <button
            className="btn-primary w-full"
            disabled={!ready || submitting}
            onClick={submit}
          >
            {submitting ? "กำลังเช็คอิน…" : "เช็คอินและเริ่มงาน"}
          </button>
        </div>
      )}
    </div>
  );
}
