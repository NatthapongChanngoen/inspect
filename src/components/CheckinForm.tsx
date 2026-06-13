"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import QrScanner from "./QrScanner";
import GpsButton, { type GpsFix } from "./GpsButton";
import PhotoInput from "./PhotoInput";

export default function CheckinForm({ checkpointId }: { checkpointId: string }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [gps, setGps] = useState<GpsFix | null>(null);
  const [before, setBefore] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const ready = !!token && !!gps && !!before;

  async function submit() {
    if (!ready) return;
    setError("");
    setSubmitting(true);
    try {
      // ขอรหัสเซสชันใหม่ (อายุสั้น ใช้ครั้งเดียว) ก่อนส่ง
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
      fd.set("token", token!);
      fd.set("lat", String(gps!.lat));
      fd.set("lng", String(gps!.lng));
      fd.set("accuracy", String(gps!.accuracy));
      // หลักฐาน GPS ดิบ ไว้ตรวจ fake GPS ฝั่ง server
      fd.set("gpsTimestamp", String(gps!.timestamp));
      if (gps!.altitude != null) fd.set("altitude", String(gps!.altitude));
      if (gps!.speed != null) fd.set("speed", String(gps!.speed));
      if (gps!.heading != null) fd.set("heading", String(gps!.heading));
      fd.set("before", before!);

      const res = await fetch("/api/checkin", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        // ถ้าเคยเช็คอินแล้ววันนี้ ให้พาไปงานเดิม
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
      <div className="card p-4">
        <div className="font-semibold mb-2">1. สแกน QR ที่จุดทำงาน</div>
        <QrScanner onResult={setToken} done={!!token} />
      </div>

      <div className="card p-4">
        <div className="font-semibold mb-2">2. ยืนยันตำแหน่ง (GPS)</div>
        <GpsButton onResult={setGps} value={gps} />
      </div>

      <div className="card p-4">
        <div className="font-semibold mb-2">3. ถ่ายรูปก่อนทำงาน</div>
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
      {!ready && (
        <p className="text-xs text-gray-500 text-center">
          กรุณาทำครบทั้ง 3 ขั้นตอนก่อนเช็คอิน
        </p>
      )}
    </div>
  );
}
