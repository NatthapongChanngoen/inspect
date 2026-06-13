import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { readUpload, contentTypeFor } from "@/lib/storage";

// เสิร์ฟรูปที่อัปโหลด (ต้องล็อกอินก่อน)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { path } = await params;
  const rel = path.join("/");

  try {
    const buf = await readUpload(rel);
    return new NextResponse(buf as unknown as BodyInit, {
      headers: {
        "Content-Type": contentTypeFor(rel),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
