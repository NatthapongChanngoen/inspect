"use client";

import { useState } from "react";

export type GpsFix = {
  lat: number;
  lng: number;
  accuracy: number;
  // หลักฐานดิบ ไว้ตรวจ fake GPS ฝั่ง server
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: number; // เวลาที่อุปกรณ์อ่านพิกัด (ms epoch)
};

export default function GpsButton({
  onResult,
  value,
}: {
  onResult: (fix: GpsFix) => void;
  value: GpsFix | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function getLocation() {
    setError("");
    if (!navigator.geolocation) {
      setError("อุปกรณ์ไม่รองรับ GPS");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoading(false);
        onResult({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          timestamp: pos.timestamp,
        });
      },
      () => {
        setLoading(false);
        setError("ไม่สามารถอ่านพิกัดได้ กรุณาอนุญาตการเข้าถึงตำแหน่ง");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 text-green-700 bg-green-50 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <span>✓</span>
          <span className="font-medium text-sm">
            ได้พิกัดแล้ว (
            {value.accuracy >= 1000
              ? `±${(value.accuracy / 1000).toFixed(1)} กม.`
              : `±${Math.round(value.accuracy)} ม.`}
            )
          </span>
        </div>
        <button
          type="button"
          className="text-sm underline text-green-800"
          onClick={getLocation}
        >
          อ่านใหม่
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn-primary w-full"
        onClick={getLocation}
        disabled={loading}
      >
        {loading ? "กำลังอ่านพิกัด…" : "อ่านพิกัด GPS"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
