import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const schema = z.object({
  name: z.string().min(1),
  username: z
    .string()
    .min(3)
    .regex(/^[a-zA-Z0-9_.]+$/, "ใช้ได้เฉพาะ a-z, 0-9, _ และ ."),
  password: z.string().min(6),
  phone: z.string().optional(),
});

// สมัครสมาชิก — บัญชีที่สมัครจะเป็น "พนักงาน" (STAFF) อัตโนมัติ
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "ข้อมูลไม่ถูกต้อง (ชื่อผู้ใช้อย่างน้อย 3 ตัว a-z/0-9, รหัสผ่านอย่างน้อย 6 ตัว)",
      },
      { status: 400 }
    );
  }
  const { name, username, password, phone } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json(
      { error: "ชื่อผู้ใช้นี้ถูกใช้แล้ว กรุณาเลือกชื่ออื่น" },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      name: name.trim(),
      username,
      phone: phone?.trim() || null,
      passwordHash,
      role: "STAFF",
      active: true,
    },
  });

  return NextResponse.json({ ok: true });
}
