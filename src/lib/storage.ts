import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

// ที่เก็บรูปอัปโหลด — เปลี่ยนเป็น MinIO/S3 ภายหลังได้โดยแก้แค่ไฟล์นี้
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);
// เอกสารแนบที่อนุญาต (นอกเหนือจากรูป)
const DOC_EXT = new Set(["pdf", "doc", "docx", "xls", "xlsx", "csv", "txt"]);
const ALLOWED_EXT = new Set([...IMAGE_EXT, ...DOC_EXT]);

// แปลง MIME → นามสกุล (ใช้ตอนชื่อไฟล์ไม่มีนามสกุลที่รู้จัก)
function extFromMime(mime: string): string | null {
  const m: Record<string, string> = {
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "text/csv": "csv",
    "text/plain": "txt",
    "image/png": "png",
    "image/webp": "webp",
    "image/jpeg": "jpg",
    "image/heic": "heic",
    "image/heif": "heif",
  };
  return m[mime] || null;
}

// บันทึกไฟล์ที่อัปโหลด คืนค่า path สัมพัทธ์ (เก็บลง DB)
export async function saveUpload(file: File, subdir = ""): Promise<string> {
  const bytes = Buffer.from(await file.arrayBuffer());
  let ext = (file.name.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  // ถ้านามสกุลไม่อยู่ในรายการอนุญาต ลองเดาจาก MIME ไม่งั้น default เป็น jpg (รูป)
  if (!ALLOWED_EXT.has(ext)) ext = extFromMime(file.type) || "jpg";
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
    case "pdf":
      return "application/pdf";
    case "doc":
      return "application/msword";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "xls":
      return "application/vnd.ms-excel";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "csv":
      return "text/csv";
    case "txt":
      return "text/plain";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    default:
      return "application/octet-stream";
  }
}
