"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PhotoInput from "./PhotoInput";

export default function CompleteRepairForm({ issueId }: { issueId: string }) {
  const router = useRouter();
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!photo) {
      setError("กรุณาถ่ายรูปหลักฐาน");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const fd = new FormData();
      fd.set("photo", photo);
      const res = await fetch(`/api/issues/${issueId}/complete`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "ปิดงานไม่สำเร็จ");
        setSubmitting(false);
        return;
      }
      router.refresh();
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <PhotoInput label="" onChange={setPhoto} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        className="btn-success"
        disabled={submitting || !photo}
        onClick={submit}
      >
        {submitting ? "กำลังปิดงาน…" : "ปิดงาน (บันทึกรูปหลักฐาน)"}
      </button>
    </div>
  );
}
