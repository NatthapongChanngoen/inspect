import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readUpload, contentTypeFor } from "@/lib/storage";

// เสิร์ฟรูปประจำจุด (รูปแรก) แบบสาธารณะ — ให้ LINE ดึงไปแสดงในข้อความ Flex ได้
// ใช้ checkpoint id (cuid สุ่ม) ไม่ใช่ qrToken → ไม่เปิดเผยความลับเช็คอิน
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cp = await prisma.checkpoint.findUnique({
    where: { id },
    select: { photoPaths: true },
  });
  const rel = cp?.photoPaths?.[0];
  if (!rel) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  try {
    const buf = await readUpload(rel);
    return new NextResponse(buf as unknown as BodyInit, {
      headers: {
        "Content-Type": contentTypeFor(rel),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
