import Link from "next/link";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import IssueForm from "@/components/IssueForm";
import { ArrowRightIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function StaffReportPage() {
  const user = await currentUser();
  if (!user) return null;

  const checkpoints = await prisma.checkpoint.findMany({
    where: { active: true },
    include: { site: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-4">
      <Link
        href="/staff"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500"
      >
        <ArrowRightIcon size={16} className="rotate-180" />
        กลับงานวันนี้
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">แจ้งปัญหา</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          แจ้งซ่อมอุปกรณ์ชำรุด หรือแจ้งของหมด
        </p>
      </div>

      <IssueForm checkpoints={checkpoints} />
    </div>
  );
}
