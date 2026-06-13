import { notFound } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function CheckpointQrPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cp = await prisma.checkpoint.findUnique({
    where: { id },
    include: { site: true },
  });
  if (!cp) notFound();

  const qr = await QRCode.toDataURL(cp.qrToken, { width: 600, margin: 2 });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 print:hidden">
        <Link href="/admin/checkpoints" className="text-sm text-gray-500">
          ← กลับ
        </Link>
        <PrintButton />
      </div>

      <div className="card p-8 max-w-md mx-auto text-center">
        <div className="text-lg font-bold mb-1">{cp.site.name}</div>
        <div className="text-2xl font-bold mb-4">{cp.name}</div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="QR Code" className="w-full max-w-xs mx-auto" />
        <div className="mt-4 text-sm text-gray-500">
          สแกนด้วยแอปเพื่อเช็คอินที่จุดนี้
        </div>
      </div>
    </div>
  );
}
