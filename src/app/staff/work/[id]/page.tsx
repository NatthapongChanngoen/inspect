import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { fmtDateTime } from "@/lib/date";
import StatusBadge from "@/components/StatusBadge";
import SubmitForm from "@/components/SubmitForm";

export const dynamic = "force-dynamic";

export default async function WorkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) return null;

  const record = await prisma.workRecord.findUnique({
    where: { id },
    include: { checkpoint: { include: { site: true } }, review: true },
  });

  if (!record) notFound();
  if (record.userId !== user.id) redirect("/staff");

  return (
    <div className="space-y-4">
      <Link href="/staff" className="text-sm text-gray-500">
        ← กลับ
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">{record.checkpoint.name}</h1>
          <p className="text-gray-500">{record.checkpoint.site.name}</p>
        </div>
        <StatusBadge status={record.status} />
      </div>

      <div className="card p-4 text-sm space-y-1 text-gray-600">
        <div>เช็คอินเมื่อ: {fmtDateTime(record.checkInAt)}</div>
        {record.submittedAt && <div>ส่งงานเมื่อ: {fmtDateTime(record.submittedAt)}</div>}
        {record.distanceMeters != null && (
          <div>ระยะจากจุด: {Math.round(record.distanceMeters)} เมตร</div>
        )}
      </div>

      <div className="card p-4">
        <div className="font-semibold mb-2">รูปก่อนทำงาน</div>
        {record.beforePhotoPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/files/${record.beforePhotoPath}`}
            alt="ก่อนทำงาน"
            className="w-full rounded-lg border max-h-72 object-contain bg-gray-50"
          />
        ) : (
          <p className="text-gray-400 text-sm">ไม่มีรูป</p>
        )}
      </div>

      {record.status === "IN_PROGRESS" ? (
        <SubmitForm workRecordId={record.id} />
      ) : (
        <>
          <div className="card p-4">
            <div className="font-semibold mb-2">รูปหลังทำงาน</div>
            {record.afterPhotoPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/files/${record.afterPhotoPath}`}
                alt="หลังทำงาน"
                className="w-full rounded-lg border max-h-72 object-contain bg-gray-50"
              />
            ) : (
              <p className="text-gray-400 text-sm">ไม่มีรูป</p>
            )}
          </div>
          {record.review && (
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold">ผลการตรวจ</span>
                <span className="badge bg-gray-100 text-gray-600">
                  {record.review.mode === "ON_SITE"
                    ? "ผู้ตรวจไปที่จุด"
                    : "ตรวจจากรูป"}
                </span>
              </div>
              <StatusBadge status={record.status} />
              {record.review.comment && (
                <p className="text-sm text-gray-700 mt-2">
                  หมายเหตุ: {record.review.comment}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                ตรวจเมื่อ {fmtDateTime(record.review.reviewedAt)}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
