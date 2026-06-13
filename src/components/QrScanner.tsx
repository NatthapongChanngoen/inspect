"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";

export default function QrScanner({
  onResult,
  done,
}: {
  onResult: (text: string) => void;
  done: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");

  function stop() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
  }

  async function start() {
    setError("");
    try {
      const reader = new BrowserQRCodeReader();
      setScanning(true);
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current!,
        (result, _err, ctrl) => {
          if (result) {
            controlsRef.current = ctrl;
            onResult(result.getText());
            ctrl.stop();
            setScanning(false);
          }
        }
      );
      controlsRef.current = controls;
    } catch {
      setError("ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการใช้กล้อง");
      setScanning(false);
    }
  }

  useEffect(() => {
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (done) {
    return (
      <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-lg p-3">
        <span>✓</span>
        <span className="font-medium">สแกน QR สำเร็จ</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative rounded-lg overflow-hidden bg-black aspect-square">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          muted
          playsInline
        />
        {!scanning && (
          <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm">
            กดปุ่มเพื่อเปิดกล้องสแกน
          </div>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {scanning ? (
        <button type="button" className="btn-ghost w-full" onClick={stop}>
          หยุดสแกน
        </button>
      ) : (
        <button type="button" className="btn-primary w-full" onClick={start}>
          เปิดกล้องสแกน QR
        </button>
      )}
    </div>
  );
}
