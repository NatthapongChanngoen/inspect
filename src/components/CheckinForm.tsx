"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QrScanner from "./QrScanner";
import PhotoInput from "./PhotoInput";
import { type GpsFix } from "./GpsButton";

export default function CheckinForm({
  checkpointId,
  liffId,
}: {
  checkpointId: string;
  liffId: string;
}) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [gps, setGps] = useState<GpsFix | null>(null);
  const [gpsError, setGpsError] = useState("");
  const [before, setBefore] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // ตรวจว่ากำลังเปิดผ่านแอป LINE (LIFF) หรือไม่ — บังคับเฉพาะตอนสแกน QR
  const [liffChecked, setLiffChecked] = useState(false);
  const [inLiff, setInLiff] = useState(false);
  const liffStarted = useRef(false);

  useEffect(() => {
    if (liffStarted.current) return;
    liffStarted.current = true;
    (async () => {
      if (!liffId) {
        setInLiff(false);
        setLiffChecked(true);
        return;
      }
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId });
        setInLiff(liff.isInClient());
      } catch {
        setInLiff(false);
      } finally {
        setLiffChecked(true);
      }
    })();
  }, [liffId]);

  // เฝ้าดู GPS ตลอดเวลา (บังคับให้เปิด GPS) — ถ้าปิด/หลุดจะเตือนและปิดปุ่มเริ่มงาน
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError("อุปกรณ์นี้ไม่รองรับ GPS");
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsError("");
        setGps({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          timestamp: pos.timestamp,
        });
      },
      (err) => {
        setGps(null);
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? "กรุณาอนุญาตและเปิด GPS ของโทรศัพท์เพื่อเริ่มงาน"
            : "อ่านพิกัดไม่ได้ — กรุณาเปิด GPS แล้วลองใหม่"
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const gpsOn = !!gps;
  const ready = gpsOn && inLiff && !!token && !!before;

  async function submit() {
    if (!ready || !gps || !token || !before) return;
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
      fd.set("lat", String(gps.lat));
      fd.set("lng", String(gps.lng));
      fd.set("accuracy", String(gps.accuracy));
      fd.set("gpsTimestamp", String(gps.timestamp));
      if (gps.altitude != null) fd.set("altitude", String(gps.altitude));
      if (gps.speed != null) fd.set("speed", String(gps.speed));
      if (gps.heading != null) fd.set("heading", String(gps.heading));
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
      {/* 1) GPS — ต้องเปิดตลอด */}
      <div className="card p-4">
        <div className="font-semibold mb-2">1. ตำแหน่ง GPS (ต้องเปิดตลอดเวลา)</div>
        {gpsOn ? (
          <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-lg p-3 text-sm font-medium">
            <span>✓</span>
            <span>
              GPS เปิดอยู่ (
              {gps!.accuracy >= 1000
                ? `±${(gps!.accuracy / 1000).toFixed(1)} กม.`
                : `±${Math.round(gps!.accuracy)} ม.`}
              )
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-red-700 bg-red-50 rounded-lg p-3 text-sm font-medium">
            <span>⚠️</span>
            <span>{gpsError || "กำลังอ่านพิกัด GPS…"}</span>
          </div>
        )}
      </div>

      {/* 2) สแกน QR — เฉพาะในแอป LINE (LIFF) */}
      <div className="card p-4">
        <div className="font-semibold mb-2">2. สแกน QR ที่จุดทำงาน</div>
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
        ) : !gpsOn ? (
          <p className="text-sm text-gray-500">เปิด GPS ก่อนจึงจะสแกน QR ได้</p>
        ) : (
          <QrScanner onResult={setToken} done={!!token} />
        )}
      </div>

      {/* 3) ถ่ายรูปก่อนทำงาน — แสดงหลังสแกน QR สำเร็จ */}
      {token && (
        <div className="card p-4">
          <div className="font-semibold mb-2">3. ถ่ายรูปก่อนทำงาน</div>
          <PhotoInput label="" onChange={setBefore} />
        </div>
      )}

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
      {!gpsOn && (
        <p className="text-xs text-red-600 text-center">
          เปิด GPS ก่อนจึงจะกดเริ่มงานได้
        </p>
      )}
    </div>
  );
}
