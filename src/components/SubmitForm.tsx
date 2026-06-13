"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PhotoInput from "./PhotoInput";

export default function SubmitForm({ workRecordId }: { workRecordId: string }) {
  const router = useRouter();
  const [after, setAfter] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!after) return;
    setError("");
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("workRecordId", workRecordId);
      fd.set("after", after);
      fd.set("note", note);
      const res = await fetch("/api/submit", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "ส่งงานไม่สำเร็จ");
        setSubmitting(false);
        return;
      }
      router.push("/staff");
      router.refresh();
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="font-semibold mb-2">ถ่ายรูปหลังทำงานเสร็จ</div>
        <PhotoInput label="" onChange={setAfter} />
      </div>

      <div className="card p-4">
        <label className="label">หมายเหตุ (ถ้ามี)</label>
        <textarea
          className="input"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="เช่น พบสิ่งผิดปกติ…"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>
      )}

      <button
        className="btn-success w-full"
        disabled={!after || submitting}
        onClick={submit}
      >
        {submitting ? "กำลังส่งงาน…" : "ส่งงานให้ตรวจสอบ"}
      </button>
    </div>
  );
}
