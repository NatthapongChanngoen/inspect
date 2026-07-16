import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import CheckinForm from "@/components/CheckinForm";

export const dynamic = "force-dynamic";

export default async function CheckinPage({
  params,
}: {
  params: Promise<{ checkpointId: string }>;
}) {
  const { checkpointId } = await params;
  const checkpoint = await prisma.checkpoint.findUnique({
    where: { id: checkpointId },
    include: { site: true, department: true },
  });

  if (!checkpoint || !checkpoint.active) notFound();

  return (
    <div className="space-y-4">
      <Link href="/staff" className="text-sm text-gray-500">
        ← กลับ
      </Link>
      <div>
        <h1 className="text-xl font-bold">{checkpoint.name}</h1>
        <p className="text-gray-500">
          {checkpoint.department ? `${checkpoint.department.name} · ` : ""}
          {checkpoint.site.name}
        </p>
        {checkpoint.description && (
          <p className="text-sm text-gray-600 mt-1">{checkpoint.description}</p>
        )}
      </div>

      <CheckinForm checkpointId={checkpoint.id} />
    </div>
  );
}
