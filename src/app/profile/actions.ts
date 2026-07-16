"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";

type ActionResult = { ok: boolean; error?: string };

// เปลี่ยนรหัสผ่านของตัวเอง (ต้องยืนยันรหัสเดิม)
export async function changeOwnPassword(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const me = await currentUser();
  if (!me) return { ok: false, error: "กรุณาเข้าสู่ระบบ" };

  const current = String(formData.get("current") || "");
  const next = String(formData.get("next") || "");
  const confirm = String(formData.get("confirm") || "");

  if (!current || !next) return { ok: false, error: "กรุณากรอกรหัสผ่าน" };
  if (next.length < 6)
    return { ok: false, error: "รหัสใหม่ต้องยาวอย่างน้อย 6 ตัวอักษร" };
  if (next !== confirm)
    return { ok: false, error: "ยืนยันรหัสใหม่ไม่ตรงกัน" };

  const user = await prisma.user.findUnique({ where: { id: me.id } });
  if (!user) return { ok: false, error: "ไม่พบผู้ใช้" };

  const ok = await bcrypt.compare(current, user.passwordHash);
  if (!ok) return { ok: false, error: "รหัสผ่านเดิมไม่ถูกต้อง" };

  const passwordHash = await bcrypt.hash(next, 10);
  await prisma.user.update({ where: { id: me.id }, data: { passwordHash } });
  return { ok: true };
}
