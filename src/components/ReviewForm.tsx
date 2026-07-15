"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import QrScanner from "./QrScanner";
import PhotoInput from "./PhotoInput";

type Mode = "REMOTE" | "ON_SITE";
type Policy = "REMOTE" | "ON_SITE" | "BOTH";

export default function ReviewForm({
  workRecordId,
  reviewPolicy = "BOTH",
}: {
  workRecordId: string;
  reviewPolicy?: Policy;
}) {
  const router = useRouter();
  // ถ้างานบังคับตรวจที่จุด → เริ่มที่โหมด ON_SITE, ไม่งั้นเริ่มระยะไกล
  const [mode, setMode] = useState<Mode>(
    reviewPolicy === "ON_SITE" ? "ON_SITE" : "REMOTE"
  );
  const [comment, setComment] = useState("");
  const [failMode, setFailMode] = useState(false); // เปิดช่องระบุรายละเอียดเมื่อกดไม่ผ่าน
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // สำหรับโหมดไปจุดจริง
  const [token, setToken] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);

  const onSiteReady = !!token && !!photo;

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

      {/* เลือกโหมดการตรวจ — แสดงให้เลือกเฉพาะงานที่อนุญาตทั้งสองแบบ */}
      {reviewPolicy === "BOTH" ? (
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
      ) : (
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-600">
          งานนี้กำหนดให้ตรวจแบบ{" "}
          <span className="font-medium text-gray-800">
            {reviewPolicy === "ON_SITE" ? "ไปตรวจที่จุด" : "ดูรูประยะไกล"}
          </span>{" "}
          เท่านั้น
        </div>
      )}

      {mode === "ON_SITE" && (
        <div className="space-y-3 border-t pt-3">
          <p className="text-sm text-gray-500">
            ยืนยันว่าผู้ตรวจอยู่ที่จุดจริง — สแกน QR + ถ่ายรูป
          </p>
          <div>
            <div className="text-sm font-medium mb-1">1. สแกน QR ที่จุด</div>
            <QrScanner onResult={setToken} done={!!token} />
          </div>
          <div>
            <div className="text-sm font-medium mb-1">2. ถ่ายรูปจากจุดตรวจ</div>
            <PhotoInput label="" onChange={setPhoto} />
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!failMode ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            className="btn-danger"
            disabled={submitting || (mode === "ON_SITE" && !onSiteReady)}
            onClick={() => {
              setError("");
              setFailMode(true);
            }}
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
      ) : (
        <div className="space-y-2 border-t pt-3">
          <div className="text-sm font-medium text-rose-700">
            ระบุรายละเอียดที่ไม่ผ่าน (แจ้งกลับให้พนักงาน)
          </div>
          <textarea
            className="input"
            rows={3}
            autoFocus
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="เช่น พื้นยังไม่สะอาด / ถังขยะยังไม่ได้เท / กระจกมีคราบ"
          />
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className="btn-ghost"
              disabled={submitting}
              onClick={() => {
                setFailMode(false);
                setComment("");
                setError("");
              }}
            >
              ยกเลิก
            </button>
            <button
              type="button"
              className="btn-danger"
              disabled={submitting || (mode === "ON_SITE" && !onSiteReady)}
              onClick={() => {
                if (!comment.trim()) {
                  setError("กรุณาระบุรายละเอียดที่ไม่ผ่าน");
                  return;
                }
                mode === "ON_SITE" ? reviewOnSite("FAIL") : reviewRemote("FAIL");
              }}
            >
              ยืนยันไม่ผ่าน
            </button>
          </div>
        </div>
      )}
      {mode === "ON_SITE" && !onSiteReady && (
        <p className="text-xs text-gray-500 text-center">
          กรุณาสแกน QR + ถ่ายรูป ก่อนกดผ่าน/ไม่ผ่าน
        </p>
      )}
    </div>
  );
}
