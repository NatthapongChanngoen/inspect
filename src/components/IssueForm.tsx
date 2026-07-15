"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PhotoInput from "./PhotoInput";

type CheckpointOpt = { id: string; name: string; site: { name: string } };
type IssueType = "REPAIR" | "SUPPLY";

export default function IssueForm({
  checkpoints,
}: {
  checkpoints: CheckpointOpt[];
}) {
  const router = useRouter();
  const [type, setType] = useState<IssueType>("REPAIR");
  const [checkpointId, setCheckpointId] = useState(checkpoints[0]?.id ?? "");
  const [detail, setDetail] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (!checkpointId || !detail.trim()) {
      setError("กรุณาเลือกจุดและกรอกรายละเอียด");
      return;
    }
    if (type === "REPAIR" && !photo) {
      setError("กรุณาถ่ายรูปปัญหา (รูปก่อนซ่อม) ก่อนแจ้ง");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("type", type);
      fd.set("checkpointId", checkpointId);
      fd.set("detail", detail.trim());
      if (photo) fd.set("photo", photo);

      const res = await fetch("/api/issues", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "แจ้งไม่สำเร็จ");
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
    <div className="card p-4 space-y-4">
      {/* ประเภท */}
      <div>
        <label className="label">ประเภทการแจ้ง</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setType("REPAIR")}
            className={`btn ${type === "REPAIR" ? "btn-primary" : "btn-ghost"}`}
          >
            🛠️ ซ่อมอุปกรณ์
          </button>
          <button
            type="button"
            onClick={() => setType("SUPPLY")}
            className={`btn ${type === "SUPPLY" ? "btn-primary" : "btn-ghost"}`}
          >
            📦 ของหมด
          </button>
        </div>
      </div>

      {/* จุด */}
      <div>
        <label className="label">จุด / สถานที่ที่พบ</label>
        <select
          className="input"
          value={checkpointId}
          onChange={(e) => setCheckpointId(e.target.value)}
        >
          {checkpoints.length === 0 && <option value="">— ไม่มีจุด —</option>}
          {checkpoints.map((c) => (
            <option key={c.id} value={c.id}>
              {c.site.name} — {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* รายละเอียด */}
      <div>
        <label className="label">
          {type === "REPAIR"
            ? "รายละเอียด (อุปกรณ์อะไร ชำรุดอย่างไร)"
            : "รายละเอียด (ของอะไรหมด)"}
        </label>
        <textarea
          className="input"
          rows={3}
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder={
            type === "REPAIR"
              ? "เช่น ก๊อกน้ำห้องน้ำชายชำรุด น้ำไหลตลอด"
              : "เช่น สบู่เหลวหมด, กระดาษทิชชูหมด"
          }
        />
      </div>

      {/* รูป — บังคับสำหรับงานซ่อม (ใช้เป็นรูปก่อนซ่อม) */}
      <div>
        <label className="label">
          {type === "REPAIR" ? "รูปก่อนซ่อม (จำเป็น)" : "รูปประกอบ (ถ้ามี)"}
        </label>
        <PhotoInput label="" onChange={setPhoto} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        className="btn-primary btn-lg w-full"
        disabled={submitting}
        onClick={submit}
      >
        {submitting ? "กำลังส่ง…" : "ส่งแจ้งปัญหา"}
      </button>
    </div>
  );
}
