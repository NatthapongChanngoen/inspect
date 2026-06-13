"use client";

import { useEffect, useRef, useState } from "react";

// ถ่ายรูปจากกล้องสดเท่านั้น (ไม่ให้เลือกรูปจากคลังภาพ)
export default function PhotoInput({
  label,
  onChange,
}: {
  label: string;
  onChange: (file: File | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  }

  async function startCamera() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("อุปกรณ์/เบราว์เซอร์นี้ไม่รองรับกล้อง");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setActive(true);
    } catch {
      setError("ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการใช้กล้อง");
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `photo-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        onChange(file);
        setPreview(URL.createObjectURL(blob));
        stopCamera();
      },
      "image/jpeg",
      0.9
    );
  }

  function retake() {
    setPreview(null);
    onChange(null);
    startCamera();
  }

  // ผูกสตรีมเข้ากับ <video> เมื่อกล้องเปิด
  useEffect(() => {
    if (active && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [active]);

  // ปิดกล้องเมื่อออกจากหน้า
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  return (
    <div>
      {label && <label className="label">{label}</label>}

      {preview ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="รูปที่ถ่าย"
            className="w-full rounded-lg border border-gray-200 max-h-72 object-contain bg-gray-50"
          />
          <button type="button" className="btn-ghost w-full" onClick={retake}>
            ถ่ายใหม่
          </button>
        </div>
      ) : active ? (
        <div className="space-y-2">
          <div className="relative rounded-lg overflow-hidden bg-black aspect-[3/4]">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              muted
              playsInline
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-ghost" onClick={stopCamera}>
              ยกเลิก
            </button>
            <button type="button" className="btn-primary" onClick={capture}>
              ถ่ายรูป
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={startCamera}
          className="flex flex-col items-center justify-center gap-2 w-full border-2 border-dashed border-gray-300 rounded-lg p-8 hover:bg-gray-50 text-gray-500"
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
            <circle cx="12" cy="13" r="3" />
          </svg>
          <span className="text-sm">เปิดกล้องเพื่อถ่ายรูป</span>
        </button>
      )}

      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
    </div>
  );
}
