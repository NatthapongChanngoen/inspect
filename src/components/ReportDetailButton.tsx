"use client";

import { useState } from "react";
import { fmtDateTime, fmtTime, lateInfo } from "@/lib/date";
import StatusBadge from "./StatusBadge";

type Review = {
  result: string;
  comment: string | null;
  mode: string;
  reviewedAt: Date | string;
  inspectorPhotoPath: string | null;
  inspectorDistanceMeters: number | null;
} | null;

export type ReportRecord = {
  id: string;
  status: string;
  checkInAt: Date | string;
  submittedAt: Date | string | null;
  checkInLat: number | null;
  checkInLng: number | null;
  distanceMeters: number | null;
  checkInAccuracy: number | null;
  checkinPhotoPath: string | null;
  beforePhotoPath: string | null;
  afterPhotoPath: string | null;
  expectedStartTime: string | null;
  lateMinutes: number | null;
  lateBaseAt?: Date | string | null;
  note: string | null;
  suspicious: boolean;
  suspiciousFlags: string[];
  user: { name: string };
  checkpoint: {
    name: string;
    site: { name: string };
    department?: { name: string } | null;
  };
  review: Review;
};

export default function ReportDetailButton({
  record: r,
}: {
  record: ReportRecord;
}) {
  const [open, setOpen] = useState(false);

  const mapsUrl =
    r.checkInLat != null && r.checkInLng != null
      ? `https://www.google.com/maps?q=${r.checkInLat},${r.checkInLng}`
      : null;

  // นับสายจาก "งานก่อนหน้าเสร็จ" หรือไม่ = ฐานเวลาช้ากว่าเวลาเริ่มที่กำหนดไว้
  const lateBaseFromPrev = (() => {
    if (!r.lateBaseAt || !r.expectedStartTime) return false;
    const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(r.expectedStartTime);
    if (!m) return false;
    const sched = new Date(r.checkInAt);
    sched.setHours(Number(m[1]), Number(m[2]), 0, 0);
    return new Date(r.lateBaseAt).getTime() > sched.getTime();
  })();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark shadow-sm transition whitespace-nowrap"
      >
        ดูรายละเอียด →
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => setOpen(false)}
        >
          <div
            className="card w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto space-y-4 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {r.checkpoint.name}
                </h2>
                <p className="text-sm text-gray-500">
                  {r.checkpoint.department
                    ? `${r.checkpoint.department.name} · `
                    : ""}
                  {r.checkpoint.site.name}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  พนักงาน: {r.user.name}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusBadge status={r.status} />
                <button
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                  onClick={() => setOpen(false)}
                  aria-label="ปิด"
                >
                  ✕
                </button>
              </div>
            </div>

            {r.suspicious && (
              <div className="rounded-xl p-3 border-2 border-amber-300 bg-amber-50 text-sm">
                <div className="font-semibold text-amber-800">
                  ⚠️ ตำแหน่งนี้น่าสงสัย
                </div>
                {r.suspiciousFlags.length > 0 && (
                  <ul className="mt-1 text-amber-800 list-disc list-inside">
                    {r.suspiciousFlags.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm space-y-1 text-gray-600">
              <div>เช็คอิน: {fmtDateTime(r.checkInAt)}</div>
              {r.expectedStartTime && (
                <div>
                  เวลาที่กำหนดเริ่ม: {r.expectedStartTime} น. ·{" "}
                  <span
                    className={
                      lateInfo(r.lateMinutes).late
                        ? "text-orange-700 font-medium"
                        : "text-emerald-700"
                    }
                  >
                    {lateInfo(r.lateMinutes).label}
                  </span>
                  {lateBaseFromPrev && (
                    <div className="text-xs text-gray-500">
                      ↳ นับสายจากงานก่อนหน้าเสร็จ {fmtTime(r.lateBaseAt!)} น.
                      (ทำงานต่อเนื่อง)
                    </div>
                  )}
                </div>
              )}
              {r.submittedAt && <div>ส่งงาน: {fmtDateTime(r.submittedAt)}</div>}
              {r.distanceMeters != null && (
                <div>ระยะจากจุด: {Math.round(r.distanceMeters)} เมตร</div>
              )}
              {r.checkInAccuracy != null && (
                <div>ความแม่นยำ GPS: ±{Math.round(r.checkInAccuracy)} เมตร</div>
              )}
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  className="text-brand-dark underline inline-block"
                >
                  ดูตำแหน่งบนแผนที่ →
                </a>
              )}
              {r.note && <div>หมายเหตุพนักงาน: {r.note}</div>}
            </div>

            {r.checkinPhotoPath && (
              <div>
                <div className="text-sm font-medium mb-1">รูปยืนยันที่จุด</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/files/${r.checkinPhotoPath}`}
                  alt="ยืนยันที่จุด"
                  className="w-full rounded-lg border object-contain bg-gray-50 max-h-60"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-sm font-medium mb-1">ก่อนทำงาน</div>
                {r.beforePhotoPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/files/${r.beforePhotoPath}`}
                    alt="ก่อน"
                    className="w-full rounded-lg border object-contain bg-gray-50"
                  />
                ) : (
                  <p className="text-gray-400 text-sm">ไม่มีรูป</p>
                )}
              </div>
              <div>
                <div className="text-sm font-medium mb-1">หลังทำงาน</div>
                {r.afterPhotoPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/files/${r.afterPhotoPath}`}
                    alt="หลัง"
                    className="w-full rounded-lg border object-contain bg-gray-50"
                  />
                ) : (
                  <p className="text-gray-400 text-sm">ไม่มีรูป</p>
                )}
              </div>
            </div>

            {r.review && (
              <div className="rounded-xl border border-gray-100 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">ผลการตรวจ</span>
                  <span className="badge bg-gray-100 text-gray-600">
                    {r.review.mode === "ON_SITE"
                      ? "ไปตรวจที่จุด"
                      : "ดูรูประยะไกล"}
                  </span>
                </div>
                <StatusBadge status={r.status} />
                {r.review.comment && (
                  <p className="text-sm text-gray-700 mt-2">
                    หมายเหตุ: {r.review.comment}
                  </p>
                )}
                {r.review.mode === "ON_SITE" && r.review.inspectorPhotoPath && (
                  <div className="mt-2">
                    <div className="text-sm font-medium mb-1">
                      รูปจากผู้ตรวจ ณ จุด
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/files/${r.review.inspectorPhotoPath}`}
                      alt="ผู้ตรวจ"
                      className="w-full rounded-lg border object-contain bg-gray-50 max-h-60"
                    />
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  เมื่อ {fmtDateTime(r.review.reviewedAt)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
