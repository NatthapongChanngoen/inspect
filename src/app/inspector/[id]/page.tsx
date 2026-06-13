import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtDateTime } from "@/lib/date";
import StatusBadge from "@/components/StatusBadge";
import ReviewForm from "@/components/ReviewForm";

export const dynamic = "force-dynamic";

export default async function ReviewDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const record = await prisma.workRecord.findUnique({
    where: { id },
    include: {
      checkpoint: { include: { site: true } },
      user: true,
      review: true,
    },
  });
  if (!record) notFound();

  const mapsUrl =
    record.checkInLat != null && record.checkInLng != null
      ? `https://www.google.com/maps?q=${record.checkInLat},${record.checkInLng}`
      : null;

  return (
    <div className="space-y-4">
      <Link href="/inspector" className="text-sm text-gray-500">
        ← กลับคิวตรวจ
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">{record.checkpoint.name}</h1>
          <p className="text-gray-500">{record.checkpoint.site.name}</p>
          <p className="text-sm text-gray-600 mt-1">พนักงาน: {record.user.name}</p>
        </div>
        <StatusBadge status={record.status} />
      </div>

      {record.suspicious && (
        <div className="card p-4 border-2 border-amber-300 bg-amber-50">
          <div className="flex items-center gap-2 font-semibold text-amber-800">
            <span>⚠️</span>
            <span>ตำแหน่งนี้น่าสงสัย — ควรตรวจสอบเพิ่มเติม</span>
          </div>
          <ul className="mt-2 text-sm text-amber-800 list-disc list-inside space-y-0.5">
            {record.suspiciousFlags.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
          <p className="text-xs text-amber-700 mt-2">
            ระบบไม่ได้บล็อกการเช็คอิน แต่พบสัญญาณที่อาจเป็นการปลอมตำแหน่ง (fake GPS)
            กรุณาพิจารณารูปถ่ายและพิจารณาไปตรวจที่จุดจริง
          </p>
        </div>
      )}

      <div className="card p-4 text-sm space-y-1 text-gray-600">
        <div>เช็คอิน: {fmtDateTime(record.checkInAt)}</div>
        {record.submittedAt && <div>ส่งงาน: {fmtDateTime(record.submittedAt)}</div>}
        {record.distanceMeters != null && (
          <div>
            ระยะจากจุด: {Math.round(record.distanceMeters)} เมตร{" "}
            <span className="text-green-700">
              {record.verifiedByQr ? "· QR ✓" : ""}
              {record.verifiedByGps ? " · GPS ✓" : ""}
            </span>
          </div>
        )}
        {record.checkInAccuracy != null && (
          <div>ความแม่นยำ GPS: ±{Math.round(record.checkInAccuracy)} เมตร</div>
        )}
        {record.gpsTimestamp != null && (
          <div>เวลาพิกัดจากอุปกรณ์: {fmtDateTime(record.gpsTimestamp)}</div>
        )}
        {(record.gpsAltitude != null ||
          record.gpsSpeed != null ||
          record.gpsHeading != null) && (
          <div>
            เซนเซอร์:{" "}
            {record.gpsAltitude != null
              ? `สูง ${Math.round(record.gpsAltitude)} ม. `
              : ""}
            {record.gpsSpeed != null
              ? `· ความเร็ว ${record.gpsSpeed.toFixed(1)} m/s `
              : ""}
            {record.gpsHeading != null
              ? `· ทิศ ${Math.round(record.gpsHeading)}°`
              : ""}
          </div>
        )}
        {mapsUrl && (
          <a href={mapsUrl} target="_blank" className="text-brand underline">
            ดูตำแหน่งบนแผนที่ →
          </a>
        )}
        {record.note && <div>หมายเหตุพนักงาน: {record.note}</div>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card p-3">
          <div className="font-semibold mb-2 text-sm">ก่อนทำงาน</div>
          {record.beforePhotoPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/files/${record.beforePhotoPath}`}
              alt="ก่อน"
              className="w-full rounded-lg border object-contain bg-gray-50"
            />
          ) : (
            <p className="text-gray-400 text-sm">ไม่มีรูป</p>
          )}
        </div>
        <div className="card p-3">
          <div className="font-semibold mb-2 text-sm">หลังทำงาน</div>
          {record.afterPhotoPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/files/${record.afterPhotoPath}`}
              alt="หลัง"
              className="w-full rounded-lg border object-contain bg-gray-50"
            />
          ) : (
            <p className="text-gray-400 text-sm">ไม่มีรูป</p>
          )}
        </div>
      </div>

      {record.status === "SUBMITTED" ? (
        <ReviewForm workRecordId={record.id} />
      ) : (
        record.review && (
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold">ตรวจแล้ว</span>
              <span className="badge bg-gray-100 text-gray-600">
                {record.review.mode === "ON_SITE"
                  ? "ไปตรวจที่จุด"
                  : "ดูรูประยะไกล"}
              </span>
            </div>
            <StatusBadge status={record.status} />
            {record.review.comment && (
              <p className="text-sm text-gray-700 mt-2">
                หมายเหตุ: {record.review.comment}
              </p>
            )}
            {record.review.mode === "ON_SITE" &&
              record.review.inspectorPhotoPath && (
                <div className="mt-3">
                  <div className="text-sm font-medium mb-1">รูปจากผู้ตรวจ ณ จุด</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/files/${record.review.inspectorPhotoPath}`}
                    alt="ผู้ตรวจ"
                    className="w-full rounded-lg border object-contain bg-gray-50 max-h-72"
                  />
                  {record.review.inspectorDistanceMeters != null && (
                    <p className="text-xs text-gray-500 mt-1">
                      ผู้ตรวจอยู่ห่างจากจุด{" "}
                      {Math.round(record.review.inspectorDistanceMeters)} เมตร
                    </p>
                  )}
                </div>
              )}
            <p className="text-xs text-gray-400 mt-1">
              เมื่อ {fmtDateTime(record.review.reviewedAt)}
            </p>
          </div>
        )
      )}
    </div>
  );
}
