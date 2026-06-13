import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

// ที่เก็บรูปอัปโหลด — เปลี่ยนเป็น MinIO/S3 ภายหลังได้โดยแก้แค่ไฟล์นี้
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);

// บันทึกไฟล์ที่อัปโหลด คืนค่า path สัมพัทธ์ (เก็บลง DB)
export async function saveUpload(file: File, subdir = ""): Promise<string> {
  const bytes = Buffer.from(await file.arrayBuffer());
  let ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!ALLOWED_EXT.has(ext)) ext = "jpg";
  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  const rel = path.posix.join(subdir, name);
  const full = path.join(UPLOAD_DIR, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, bytes);
  return rel;
}

// อ่านไฟล์กลับมา (กัน path traversal)
export async function readUpload(rel: string): Promise<Buffer> {
  const resolved = path.resolve(UPLOAD_DIR, rel);
  if (!resolved.startsWith(path.resolve(UPLOAD_DIR))) {
    throw new Error("invalid path");
  }
  return fs.readFile(resolved);
}

export function contentTypeFor(rel: string): string {
  const ext = rel.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "heic":
    case "heif":
      return "image/heic";
    default:
      return "image/jpeg";
  }
}
