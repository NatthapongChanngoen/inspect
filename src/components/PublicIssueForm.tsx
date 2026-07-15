"use client";

import { useEffect, useRef, useState } from "react";
import PhotoInput from "./PhotoInput";

type CheckpointOpt = { id: string; name: string; site: { name: string } };
type IssueType = "REPAIR" | "SUPPLY";
type Status = "loading" | "config" | "ready" | "done" | "error";

export default function PublicIssueForm({
  liffId,
  checkpoints,
}: {
  liffId: string;
  checkpoints: CheckpointOpt[];
}) {
  const [status, setStatus] = useState<Status>(liffId ? "loading" : "config");
  const [error, setError] = useState("");
  const [idToken, setIdToken] = useState("");
  const [displayName, setDisplayName] = useState("");
  const started = useRef(false);

  // ฟอร์ม
  const [type, setType] = useState<IssueType>("REPAIR");
  const [checkpointId, setCheckpointId] = useState(checkpoints[0]?.id ?? "");
  const [detail, setDetail] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!liffId || started.current) return;
    started.current = true;
    (async () => {
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId });
        if (!liff.isLoggedIn()) {
          liff.login(); // เด้งไปหน้าอนุญาต LINE แล้วกลับมาที่ url เดิม (?to=report)
          return;
        }
        const token = liff.getIDToken();
        if (!token) {
          setError("ไม่ได้รับข้อมูลจาก LINE กรุณาลองใหม่");
          setStatus("error");
          return;
        }
        setIdToken(token);
        try {
          const p = await liff.getProfile();
          setDisplayName(p.displayName ?? "");
        } catch {
          /* ไม่มีชื่อก็ยังแจ้งได้ */
        }
        setStatus("ready");
      } catch {
        setError("เปิดผ่านแอป LINE เท่านั้น หรือยังตั้งค่า LIFF ไม่ถูกต้อง");
        setStatus("error");
      }
    })();
  }, [liffId]);

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
      fd.set("idToken", idToken);
      fd.set("type", type);
      fd.set("checkpointId", checkpointId);
      fd.set("detail", detail.trim());
      if (photo) fd.set("photo", photo);

      const res = await fetch("/api/issues/public", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "แจ้งไม่สำเร็จ");
        setSubmitting(false);
        return;
      }
      setStatus("done");
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
      setSubmitting(false);
    }
  }

  function reportAnother() {
    setType("REPAIR");
    setCheckpointId(checkpoints[0]?.id ?? "");
    setDetail("");
    setPhoto(null);
    setSubmitting(false);
    setError("");
    setStatus("ready");
  }

  if (status === "config")
    return (
      <p className="text-sm text-gray-500 text-center">
        ยังไม่ได้ตั้งค่า LINE (LIFF) — ผู้ดูแลระบบต้องใส่ <code>LIFF_ID</code> ก่อน
      </p>
    );

  if (status === "loading")
    return (
      <p className="text-center text-gray-400 text-sm">กำลังเชื่อมต่อ LINE…</p>
    );

  if (status === "error")
    return <p className="text-sm text-red-600 text-center">{error}</p>;

  if (status === "done")
    return (
      <div className="text-center space-y-4 py-4">
        <div className="text-4xl">✅</div>
        <div>
          <p className="font-semibold text-gray-900">ส่งแจ้งซ่อมเรียบร้อยแล้ว</p>
          <p className="text-sm text-gray-500 mt-1">
            ขอบคุณครับ ทางฝ่ายที่เกี่ยวข้องจะได้รับแจ้งเตือน
          </p>
        </div>
        <button className="btn-ghost" onClick={reportAnother}>
          แจ้งเพิ่มอีก
        </button>
      </div>
    );

  // status === "ready"
  return (
    <div className="space-y-4">
      {displayName && (
        <p className="text-sm text-gray-500 text-center">
          แจ้งในนาม <span className="font-medium text-gray-700">{displayName}</span>
        </p>
      )}

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
