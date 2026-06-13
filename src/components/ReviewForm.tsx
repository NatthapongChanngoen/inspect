"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import QrScanner from "./QrScanner";
import GpsButton, { type GpsFix } from "./GpsButton";
import PhotoInput from "./PhotoInput";

type Mode = "REMOTE" | "ON_SITE";

export default function ReviewForm({ workRecordId }: { workRecordId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("REMOTE");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // สำหรับโหมดไปจุดจริง
  const [token, setToken] = useState<string | null>(null);
  const [gps, setGps] = useState<GpsFix | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);

  const onSiteReady = !!token && !!gps && !!photo;

  async function reviewRemote(result: "PASS" | "FAIL") {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workRecordId, result, comment }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "บันทึกไม่สำเร็จ");
        setSubmitting(false);
        return;
      }
      router.push("/inspector");
      router.refresh();
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
      setSubmitting(false);
    }
  }

  async function reviewOnSite(result: "PASS" | "FAIL") {
    if (!onSiteReady) return;
    setError("");
    setSubmitting(true);
    try {
      const sRes = await fetch("/api/review/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workRecordId }),
      });
      const sData = await sRes.json();
      if (!sRes.ok) {
        setError(sData.error || "เริ่มเซสชันไม่สำเร็จ");
        setSubmitting(false);
        return;
      }

      const fd = new FormData();
      fd.set("workRecordId", workRecordId);
      fd.set("nonce", sData.nonce);
      fd.set("token", token!);
      fd.set("result", result);
      fd.set("comment", comment);
      fd.set("lat", String(gps!.lat));
      fd.set("lng", String(gps!.lng));
      fd.set("accuracy", String(gps!.accuracy));
      fd.set("photo", photo!);

      const res = await fetch("/api/review/onsite", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "บันทึกไม่สำเร็จ");
        setSubmitting(false);
        return;
      }
      router.push("/inspector");
      router.refresh();
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
      setSubmitting(false);
    }
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="font-semibold">ผลการตรวจ</div>

      {/* เลือกโหมดการตรวจ */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMode("REMOTE")}
          className={`btn ${mode === "REMOTE" ? "btn-primary" : "btn-ghost"} text-sm`}
        >
          ดูรูประยะไกล
        </button>
        <button
          type="button"
          onClick={() => setMode("ON_SITE")}
          className={`btn ${mode === "ON_SITE" ? "btn-primary" : "btn-ghost"} text-sm`}
        >
          ไปตรวจที่จุด
        </button>
      </div>

      {mode === "ON_SITE" && (
        <div className="space-y-3 border-t pt-3">
          <p className="text-sm text-gray-500">
            ยืนยันว่าผู้ตรวจอยู่ที่จุดจริง — สแกน QR + GPS + ถ่ายรูป
          </p>
          <div>
            <div className="text-sm font-medium mb-1">1. สแกน QR ที่จุด</div>
            <QrScanner onResult={setToken} done={!!token} />
          </div>
          <div>
            <div className="text-sm font-medium mb-1">2. ยืนยันตำแหน่ง (GPS)</div>
            <GpsButton onResult={setGps} value={gps} />
          </div>
          <div>
            <div className="text-sm font-medium mb-1">3. ถ่ายรูปจากจุดตรวจ</div>
            <PhotoInput label="" onChange={setPhoto} />
          </div>
        </div>
      )}

      <textarea
        className="input"
        rows={2}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="หมายเหตุ (ถ้าไม่ผ่าน ควรระบุเหตุผล)"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-2 gap-3">
        <button
          className="btn-danger"
          disabled={submitting || (mode === "ON_SITE" && !onSiteReady)}
          onClick={() =>
            mode === "ON_SITE" ? reviewOnSite("FAIL") : reviewRemote("FAIL")
          }
        >
          ไม่ผ่าน
        </button>
        <button
          className="btn-success"
          disabled={submitting || (mode === "ON_SITE" && !onSiteReady)}
          onClick={() =>
            mode === "ON_SITE" ? reviewOnSite("PASS") : reviewRemote("PASS")
          }
        >
          ผ่าน
        </button>
      </div>
      {mode === "ON_SITE" && !onSiteReady && (
        <p className="text-xs text-gray-500 text-center">
          กรุณาสแกน QR + GPS + ถ่ายรูป ก่อนกดผ่าน/ไม่ผ่าน
        </p>
      )}
    </div>
  );
}
