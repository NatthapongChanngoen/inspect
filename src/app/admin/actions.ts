"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { fmtDate } from "@/lib/date";
import { pushMessage, buildAssignmentMessage } from "@/lib/lineMessaging";
import type { Role } from "@prisma/client";

async function assertAdmin() {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") {
    throw new Error("ไม่มีสิทธิ์");
  }
}

// ---------- ผู้ใช้ ----------
type ActionResult = { ok: boolean; error?: string };

export async function createUser(formData: FormData): Promise<ActionResult> {
  await assertAdmin();
  const name = String(formData.get("name") || "").trim();
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "STAFF") as Role;
  const phone = String(formData.get("phone") || "").trim() || null;
  const nationalId =
    String(formData.get("nationalId") || "").replace(/\D/g, "") || null;

  if (!name || !username || !password)
    return { ok: false, error: "กรุณากรอกชื่อ ชื่อผู้ใช้ และรหัสผ่าน" };
  // เลขบัตรประชาชน (ถ้ากรอก) ต้อง 13 หลัก
  if (nationalId && nationalId.length !== 13)
    return { ok: false, error: "เลขบัตรประชาชนต้องมี 13 หลัก" };

  // กันชื่อผู้ใช้/เลขบัตรซ้ำ
  const dup = await prisma.user.findFirst({
    where: {
      OR: [{ username }, ...(nationalId ? [{ nationalId }] : [])],
    },
    select: { username: true, nationalId: true },
  });
  if (dup) {
    return {
      ok: false,
      error:
        dup.username === username
          ? "ชื่อผู้ใช้นี้ถูกใช้แล้ว"
          : "เลขบัตรประชาชนนี้ถูกใช้แล้ว",
    };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { name, username, role, phone, nationalId, passwordHash },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

// สำหรับ useActionState ในฟอร์ม Pop-up เพิ่มผู้ใช้
export async function createUserState(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  return createUser(formData);
}

export async function toggleUserActive(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id"));
  const user = await prisma.user.findUnique({ where: { id } });
  if (user) {
    await prisma.user.update({
      where: { id },
      data: { active: !user.active },
    });
  }
  revalidatePath("/admin/users");
}

export async function deleteUser(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  await assertAdmin();
  const me = await currentUser();
  if (me?.id === id) {
    return { ok: false, error: "ลบบัญชีตัวเองไม่ได้" };
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return { ok: false, error: "ไม่พบผู้ใช้" };

  // กันลบถ้ามีประวัติงาน/การตรวจ (เพื่อคงหลักฐาน) — ให้ใช้ "ปิดใช้งาน" แทน
  const works = await prisma.workRecord.count({ where: { userId: id } });
  const reviews = await prisma.review.count({ where: { inspectorId: id } });
  if (works + reviews > 0) {
    return {
      ok: false,
      error: `ลบไม่ได้ มีประวัติงาน/การตรวจ ${
        works + reviews
      } รายการ — ใช้ "ปิดใช้งาน" แทน`,
    };
  }

  // กันลบผู้ดูแลระบบคนสุดท้าย
  if (target.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      return { ok: false, error: "ลบผู้ดูแลระบบคนสุดท้ายไม่ได้" };
    }
  }

  // ลบผู้ใช้ (งานที่มอบหมายให้คนนี้จะถูกลบตาม cascade)
  await prisma.user.delete({ where: { id } });
  revalidatePath("/admin/users");
  revalidatePath("/admin/assignments");
  return { ok: true };
}

export async function resetPassword(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id"));
  const password = String(formData.get("password") || "");
  if (!password) return;
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id }, data: { passwordHash } });
  revalidatePath("/admin/users");
}

// ---------- สถานที่ ----------
export async function createSite(formData: FormData) {
  await assertAdmin();
  const name = String(formData.get("name") || "").trim();
  const address = String(formData.get("address") || "").trim() || null;
  if (!name) return;
  await prisma.site.create({ data: { name, address } });
  revalidatePath("/admin/sites");
  revalidatePath("/admin/checkpoints");
}

export async function updateSite(
  id: string,
  name: string,
  address: string
): Promise<{ ok: boolean; error?: string }> {
  await assertAdmin();
  if (!name.trim()) return { ok: false, error: "กรุณากรอกชื่อสถานที่" };
  await prisma.site.update({
    where: { id },
    data: { name: name.trim(), address: address.trim() || null },
  });
  revalidatePath("/admin/sites");
  revalidatePath("/admin/checkpoints");
  return { ok: true };
}

export async function toggleSiteActive(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  await assertAdmin();
  const s = await prisma.site.findUnique({ where: { id } });
  if (s) {
    await prisma.site.update({ where: { id }, data: { active: !s.active } });
  }
  revalidatePath("/admin/sites");
  revalidatePath("/admin/checkpoints");
  return { ok: true };
}

export async function deleteSite(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  await assertAdmin();
  // กันลบถ้ามีประวัติการทำงานในจุดของสถานที่นี้ (เพื่อคงหลักฐาน) — ให้ใช้ "ปิดใช้งาน" แทน
  const workCount = await prisma.workRecord.count({
    where: { checkpoint: { siteId: id } },
  });
  if (workCount > 0) {
    return {
      ok: false,
      error: `ลบไม่ได้ มีประวัติการทำงาน ${workCount} รายการในจุดของสถานที่นี้ — ใช้ "ปิดใช้งาน" แทน`,
    };
  }
  // ลบสถานที่ (จุดเช็คอิน + การมอบหมายงานที่ผูกอยู่จะถูกลบตาม cascade)
  await prisma.site.delete({ where: { id } });
  revalidatePath("/admin/sites");
  revalidatePath("/admin/checkpoints");
  revalidatePath("/admin/assignments");
  return { ok: true };
}

// ---------- จุดเช็คอิน ----------
export async function createCheckpoint(formData: FormData) {
  await assertAdmin();
  const siteId = String(formData.get("siteId") || "");
  const name = String(formData.get("name") || "").trim();
  const latitude = parseFloat(String(formData.get("latitude")));
  const longitude = parseFloat(String(formData.get("longitude")));
  const radiusMeters = parseInt(String(formData.get("radiusMeters") || "50"), 10);
  const description = String(formData.get("description") || "").trim() || null;

  if (!siteId || !name || Number.isNaN(latitude) || Number.isNaN(longitude)) return;

  await prisma.checkpoint.create({
    data: {
      siteId,
      name,
      latitude,
      longitude,
      radiusMeters: Number.isNaN(radiusMeters) ? 50 : radiusMeters,
      description,
    },
  });
  revalidatePath("/admin/checkpoints");
  revalidatePath("/admin/assignments");
}

export async function toggleCheckpointActive(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id"));
  const cp = await prisma.checkpoint.findUnique({ where: { id } });
  if (cp) {
    await prisma.checkpoint.update({
      where: { id },
      data: { active: !cp.active },
    });
  }
  revalidatePath("/admin/checkpoints");
}

export async function toggleCheckpointActiveById(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  await assertAdmin();
  const cp = await prisma.checkpoint.findUnique({ where: { id } });
  if (cp) {
    await prisma.checkpoint.update({
      where: { id },
      data: { active: !cp.active },
    });
  }
  revalidatePath("/admin/checkpoints");
  return { ok: true };
}

export async function deleteCheckpoint(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  await assertAdmin();
  // กันลบถ้ามีประวัติการทำงานของจุดนี้ (เพื่อคงหลักฐาน) — ให้ใช้ "ปิดใช้งาน" แทน
  const workCount = await prisma.workRecord.count({
    where: { checkpointId: id },
  });
  if (workCount > 0) {
    return {
      ok: false,
      error: `ลบไม่ได้ มีประวัติการทำงาน ${workCount} รายการของจุดนี้ — ใช้ "ปิดใช้งาน" แทน`,
    };
  }
  // ลบจุด (การมอบหมายงานที่ผูกอยู่จะถูกลบตาม cascade)
  await prisma.checkpoint.delete({ where: { id } });
  revalidatePath("/admin/checkpoints");
  revalidatePath("/admin/assignments");
  return { ok: true };
}

// ---------- มอบหมายงาน ----------
export async function createAssignment(formData: FormData) {
  await assertAdmin();
  const userId = String(formData.get("userId") || "");
  const checkpointId = String(formData.get("checkpointId") || "");
  const dateStr = String(formData.get("scheduledDate") || "");
  const startTime = String(formData.get("startTime") || "").trim() || null;
  const note = String(formData.get("note") || "").trim() || null;

  if (!userId || !checkpointId || !dateStr) return;
  const scheduledDate = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(scheduledDate.getTime())) return;

  await prisma.assignment.create({
    data: { userId, checkpointId, scheduledDate, startTime, note },
  });

  // แจ้งเตือนเข้า LINE OA (ถ้าพนักงานผูก LINE แล้ว + ตั้ง token)
  await notifyAssignment({ userId, checkpointId, scheduledDate, startTime, note });

  revalidatePath("/admin/assignments");
}

// ส่งข้อความแจ้งงานใหม่เข้า LINE ให้พนักงาน (เงียบถ้าไม่มี token/ไม่ผูก LINE)
async function notifyAssignment(opts: {
  userId: string;
  checkpointId: string;
  scheduledDate: Date;
  startTime: string | null;
  note: string | null;
}) {
  try {
    const [user, checkpoint] = await Promise.all([
      prisma.user.findUnique({ where: { id: opts.userId } }),
      prisma.checkpoint.findUnique({
        where: { id: opts.checkpointId },
        include: { site: true },
      }),
    ]);
    if (!user?.lineUserId || !checkpoint) return;

    const msg = buildAssignmentMessage({
      staffName: user.name,
      checkpointName: checkpoint.name,
      siteName: checkpoint.site.name,
      dateStr: fmtDate(opts.scheduledDate),
      timeStr: opts.startTime,
      note: opts.note,
    });
    await pushMessage(user.lineUserId, [msg]);
  } catch (e) {
    console.error("[line] notifyAssignment:", e);
  }
}

export async function deleteAssignment(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id"));
  await prisma.assignment.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/assignments");
}

// ---------- งานประจำ (Schedule) ----------
function presetToDays(preset: string, custom: number[]): number[] {
  switch (preset) {
    case "daily":
      return [0, 1, 2, 3, 4, 5, 6];
    case "weekdays":
      return [1, 2, 3, 4, 5];
    case "weekends":
      return [0, 6];
    default:
      return custom;
  }
}

export async function createSchedule(formData: FormData) {
  await assertAdmin();
  const userId = String(formData.get("userId") || "");
  const checkpointId = String(formData.get("checkpointId") || "");
  const preset = String(formData.get("preset") || "weekdays");
  const startTime = String(formData.get("startTime") || "").trim() || null;
  const note = String(formData.get("note") || "").trim() || null;
  const custom = formData
    .getAll("dow")
    .map((d) => parseInt(String(d), 10))
    .filter((n) => n >= 0 && n <= 6);

  const daysOfWeek = presetToDays(preset, custom);
  if (!userId || !checkpointId || daysOfWeek.length === 0) return;

  await prisma.schedule.create({
    data: { userId, checkpointId, daysOfWeek, startTime, note },
  });
  revalidatePath("/admin/assignments");
}

export async function deleteSchedule(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id"));
  await prisma.schedule.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/assignments");
}
