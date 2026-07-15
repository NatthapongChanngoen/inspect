"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { canAssign } from "@/lib/permissions";
import { saveUpload } from "@/lib/storage";
import { fmtDate, fmtDateTime } from "@/lib/date";
import {
  pushMessage,
  buildAssignmentMessage,
  buildAssignmentBatchMessage,
  buildProposalMessage,
  buildRepairApprovedMessage,
  checkpointPhotoUrl,
} from "@/lib/lineMessaging";
import type { Role, StaffType } from "@prisma/client";

// แปลงค่า staffType จากฟอร์มให้เป็น enum ที่ถูกต้อง (หรือ null)
function parseStaffType(v: string): StaffType | null {
  return v === "HOUSEKEEPER" || v === "SECURITY" ? v : null;
}

async function assertAdmin() {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") {
    throw new Error("ไม่มีสิทธิ์");
  }
}

// ประตูสำหรับงาน "มอบหมายงาน + จัดการสถานที่/จุด" → ADMIN + ผู้สั่งงาน
// แยกจาก assertAdmin เพราะ assertAdmin คุมทุกอย่าง (ลบผู้ใช้/รีเซ็ตรหัส/ลบสถานที่)
// ถ้าเอาผู้สั่งงานยัดเข้า assertAdmin จะเปิดสิทธิ์ทั้งกระดานพร้อมกัน
async function assertCanAssign() {
  const user = await currentUser();
  if (!user || !canAssign(user.role)) {
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
  // ประเภทพนักงานมีผลเฉพาะ role STAFF
  const staffType =
    role === "STAFF"
      ? parseStaffType(String(formData.get("staffType") || ""))
      : null;

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

  const departmentId = String(formData.get("departmentId") || "") || null;
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      name,
      username,
      role,
      phone,
      nationalId,
      staffType,
      departmentId,
      passwordHash,
    },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

// ตั้ง/แก้ "ประเภทพนักงาน" (แม่บ้าน/รปภ.) แบบ inline ในรายการผู้ใช้
export async function setStaffType(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id"));
  const staffType = parseStaffType(String(formData.get("staffType") || ""));
  await prisma.user
    .update({ where: { id }, data: { staffType } })
    .catch(() => {});
  revalidatePath("/admin/users");
}

// สำหรับ useActionState ในฟอร์ม Pop-up เพิ่มผู้ใช้
export async function createUserState(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  return createUser(formData);
}

// แก้ไขข้อมูลผู้ใช้ (ชื่อ/เบอร์/เลขบัตร/บทบาท/ประเภท) — ไม่แตะ username/รหัส/LINE
export async function updateUser(formData: FormData): Promise<ActionResult> {
  await assertAdmin();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const role = String(formData.get("role") || "STAFF") as Role;
  const phone = String(formData.get("phone") || "").trim() || null;
  const nationalId =
    String(formData.get("nationalId") || "").replace(/\D/g, "") || null;
  const staffType =
    role === "STAFF"
      ? parseStaffType(String(formData.get("staffType") || ""))
      : null;

  if (!id) return { ok: false, error: "ไม่พบผู้ใช้" };
  if (!name) return { ok: false, error: "กรุณากรอกชื่อ" };
  if (nationalId && nationalId.length !== 13)
    return { ok: false, error: "เลขบัตรประชาชนต้องมี 13 หลัก" };
  if (nationalId) {
    const dup = await prisma.user.findFirst({
      where: { nationalId, NOT: { id } },
      select: { id: true },
    });
    if (dup) return { ok: false, error: "เลขบัตรประชาชนนี้ถูกใช้แล้ว" };
  }

  const departmentId = String(formData.get("departmentId") || "") || null;
  await prisma.user.update({
    where: { id },
    data: { name, role, phone, nationalId, staffType, departmentId },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function updateUserState(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  return updateUser(formData);
}

// ยกเลิกการผูก LINE ของผู้ใช้ (กรณีเปลี่ยนเครื่อง/ลาออก/ผูกผิดคน)
export async function unbindLine(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id"));
  await prisma.user
    .update({ where: { id }, data: { lineUserId: null } })
    .catch(() => {});
  revalidatePath("/admin/users");
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
  await assertCanAssign();
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
  await assertCanAssign();
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
  await assertCanAssign();
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

// ---------- ฝ่าย ----------
export async function createDepartment(formData: FormData) {
  await assertAdmin();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  await prisma.department.create({ data: { name } });
  revalidatePath("/admin/departments");
  revalidatePath("/admin/checkpoints");
}

export async function updateDepartment(
  id: string,
  name: string
): Promise<{ ok: boolean; error?: string }> {
  await assertAdmin();
  if (!name.trim()) return { ok: false, error: "กรุณากรอกชื่อฝ่าย" };
  await prisma.department.update({
    where: { id },
    data: { name: name.trim() },
  });
  revalidatePath("/admin/departments");
  revalidatePath("/admin/checkpoints");
  return { ok: true };
}

export async function toggleDepartmentActive(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  await assertAdmin();
  const d = await prisma.department.findUnique({ where: { id } });
  if (d) {
    await prisma.department.update({
      where: { id },
      data: { active: !d.active },
    });
  }
  revalidatePath("/admin/departments");
  revalidatePath("/admin/checkpoints");
  return { ok: true };
}

export async function deleteDepartment(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  await assertAdmin();
  // ลบฝ่ายได้เลย — จุดเช็คอินในฝ่ายนี้จะถูกปลดออกจากฝ่าย (departmentId = null) ไม่ถูกลบ
  await prisma.department.delete({ where: { id } });
  revalidatePath("/admin/departments");
  revalidatePath("/admin/checkpoints");
  revalidatePath("/admin/assignments");
  return { ok: true };
}

// ---------- จุดเช็คอิน ----------
const CP_PHOTO_MIN = 2;
const CP_PHOTO_MAX = 5;

// ดึงไฟล์รูปที่แนบมา (field "photos") เฉพาะที่เป็นไฟล์จริง
function pickPhotos(formData: FormData): File[] {
  return formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);
}

export async function createCheckpoint(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  await assertCanAssign();
  const siteId = String(formData.get("siteId") || "");
  const departmentId = String(formData.get("departmentId") || "") || null;
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;

  if (!siteId || !name)
    return { ok: false, error: "กรุณาเลือกสถานที่และกรอกชื่อจุด" };

  const photos = pickPhotos(formData);
  if (photos.length < CP_PHOTO_MIN)
    return { ok: false, error: `กรุณาเพิ่มรูปอย่างน้อย ${CP_PHOTO_MIN} รูป` };
  if (photos.length > CP_PHOTO_MAX)
    return { ok: false, error: `รูปได้สูงสุด ${CP_PHOTO_MAX} รูป` };

  const photoPaths: string[] = [];
  for (const f of photos) photoPaths.push(await saveUpload(f, "checkpoints"));

  await prisma.checkpoint.create({
    data: { siteId, departmentId, name, description, photoPaths },
  });
  revalidatePath("/admin/checkpoints");
  revalidatePath("/admin/assignments");
  return { ok: true };
}

// เพิ่มรูปให้จุด (รวมแล้วต้องไม่เกิน 5 และไม่ทำให้เหลือน้อยกว่า 2)
export async function addCheckpointPhotos(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  await assertCanAssign();
  const id = String(formData.get("checkpointId") || "");
  const cp = await prisma.checkpoint.findUnique({
    where: { id },
    select: { photoPaths: true },
  });
  if (!cp) return { ok: false, error: "ไม่พบจุดนี้" };

  const photos = pickPhotos(formData);
  if (photos.length === 0) return { ok: false, error: "ยังไม่ได้เลือกรูป" };
  const total = cp.photoPaths.length + photos.length;
  if (total > CP_PHOTO_MAX)
    return { ok: false, error: `รวมแล้วเกิน ${CP_PHOTO_MAX} รูป` };
  if (total < CP_PHOTO_MIN)
    return { ok: false, error: `ต้องมีรูปอย่างน้อย ${CP_PHOTO_MIN} รูป` };

  const added: string[] = [];
  for (const f of photos) added.push(await saveUpload(f, "checkpoints"));

  await prisma.checkpoint.update({
    where: { id },
    data: { photoPaths: [...cp.photoPaths, ...added] },
  });
  revalidatePath("/admin/checkpoints");
  return { ok: true };
}

// ลบรูปออกจากจุด (ห้ามเหลือน้อยกว่า 2)
export async function removeCheckpointPhoto(
  id: string,
  path: string
): Promise<{ ok: boolean; error?: string }> {
  await assertCanAssign();
  const cp = await prisma.checkpoint.findUnique({
    where: { id },
    select: { photoPaths: true },
  });
  if (!cp) return { ok: false, error: "ไม่พบจุดนี้" };
  if (cp.photoPaths.length <= CP_PHOTO_MIN)
    return { ok: false, error: `ต้องเหลือรูปอย่างน้อย ${CP_PHOTO_MIN} รูป` };

  await prisma.checkpoint.update({
    where: { id },
    data: { photoPaths: cp.photoPaths.filter((p) => p !== path) },
  });
  revalidatePath("/admin/checkpoints");
  return { ok: true };
}

// ตั้ง/แก้ "ฝ่าย" ของจุดเช็คอินแบบ inline ในรายการจุด
export async function setCheckpointDepartment(
  id: string,
  departmentId: string | null
) {
  await assertCanAssign();
  await prisma.checkpoint
    .update({ where: { id }, data: { departmentId: departmentId || null } })
    .catch(() => {});
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
  await assertCanAssign();
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
      photoUrl: checkpoint.photoPaths.length
        ? checkpointPhotoUrl(checkpoint.id)
        : null,
    });
    await pushMessage(user.lineUserId, [msg]);
  } catch (e) {
    console.error("[line] notifyAssignment:", e);
  }
}

// มอบหมายหลายงานพร้อมกัน (จากรายการที่เตรียมไว้ฝั่ง client)
type BatchAssignItem = {
  userId: string;
  checkpointId: string;
  date: string; // "YYYY-MM-DD"
  startTime?: string | null;
  note?: string | null;
  reviewPolicy?: string | null;
};

// แปลงค่าวิธีตรวจให้ปลอดภัย (ค่าเริ่ม = BOTH)
function toReviewPolicy(v: unknown): "REMOTE" | "ON_SITE" | "BOTH" {
  return v === "REMOTE" || v === "ON_SITE" ? v : "BOTH";
}

export async function createAssignmentsBatch(
  items: BatchAssignItem[]
): Promise<{ ok: boolean; created: number; error?: string }> {
  await assertCanAssign();
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, created: 0, error: "ยังไม่มีงานในรายการ" };
  }

  const createdItems: {
    userId: string;
    checkpointId: string;
    scheduledDate: Date;
    startTime: string | null;
    note: string | null;
  }[] = [];

  for (const it of items) {
    const userId = String(it.userId || "");
    const checkpointId = String(it.checkpointId || "");
    const dateStr = String(it.date || "");
    const startTime = (it.startTime || "").trim() || null;
    const note = (it.note || "").trim() || null;
    const reviewPolicy = toReviewPolicy(it.reviewPolicy);
    if (!userId || !checkpointId || !dateStr) continue;

    const scheduledDate = new Date(dateStr + "T00:00:00");
    if (Number.isNaN(scheduledDate.getTime())) continue;

    await prisma.assignment.create({
      data: {
        userId,
        checkpointId,
        scheduledDate,
        startTime,
        note,
        reviewPolicy,
      },
    });
    createdItems.push({ userId, checkpointId, scheduledDate, startTime, note });
  }

  // แจ้งเตือน LINE — รวมงานของพนักงานคนเดียวเป็นข้อความเดียว
  await notifyAssignmentsBatch(createdItems);

  revalidatePath("/admin/assignments");
  return { ok: true, created: createdItems.length };
}

// ส่งแจ้งเตือนงานที่มอบหมาย โดยจัดกลุ่มตามพนักงาน → 1 ข้อความต่อคน
async function notifyAssignmentsBatch(
  items: {
    userId: string;
    checkpointId: string;
    scheduledDate: Date;
    startTime: string | null;
    note: string | null;
  }[]
) {
  if (items.length === 0) return;
  try {
    const userIds = [...new Set(items.map((i) => i.userId))];
    const checkpointIds = [...new Set(items.map((i) => i.checkpointId))];
    const [users, checkpoints] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, lineUserId: true },
      }),
      prisma.checkpoint.findMany({
        where: { id: { in: checkpointIds } },
        include: { site: true },
      }),
    ]);
    const userMap = new Map(users.map((u) => [u.id, u]));
    const cpMap = new Map(checkpoints.map((c) => [c.id, c]));

    const byUser = new Map<string, typeof items>();
    for (const it of items) {
      const arr = byUser.get(it.userId) ?? [];
      arr.push(it);
      byUser.set(it.userId, arr);
    }

    for (const [userId, jobs] of byUser) {
      const user = userMap.get(userId);
      if (!user?.lineUserId) continue;

      const jobList = jobs.map((j) => {
        const cp = cpMap.get(j.checkpointId);
        return {
          checkpointName: cp?.name ?? "",
          siteName: cp?.site.name ?? "",
          dateStr: fmtDate(j.scheduledDate),
          timeStr: j.startTime,
          note: j.note,
          photoUrl:
            cp && cp.photoPaths.length ? checkpointPhotoUrl(cp.id) : null,
        };
      });

      const msg =
        jobList.length === 1
          ? buildAssignmentMessage({ staffName: user.name, ...jobList[0] })
          : buildAssignmentBatchMessage({ staffName: user.name, jobs: jobList });
      await pushMessage(user.lineUserId, [msg]);
    }
  } catch (e) {
    console.error("[line] notifyAssignmentsBatch:", e);
  }
}

export async function deleteAssignment(formData: FormData) {
  await assertCanAssign();
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

// ตั้งงานประจำหลายรายการพร้อมกัน (จากรายการที่เตรียมไว้ฝั่ง client)
type BatchScheduleItem = {
  userId: string;
  checkpointId: string;
  daysOfWeek: number[];
  startTime?: string | null;
  note?: string | null;
  reviewPolicy?: string | null;
};

export async function createSchedulesBatch(
  items: BatchScheduleItem[]
): Promise<{ ok: boolean; created: number; error?: string }> {
  await assertCanAssign();
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, created: 0, error: "ยังไม่มีงานในรายการ" };
  }

  let created = 0;
  for (const it of items) {
    const userId = String(it.userId || "");
    const checkpointId = String(it.checkpointId || "");
    const daysOfWeek = (Array.isArray(it.daysOfWeek) ? it.daysOfWeek : [])
      .map((n) => Number(n))
      .filter((n) => n >= 0 && n <= 6);
    const startTime = (it.startTime || "").trim() || null;
    const note = (it.note || "").trim() || null;
    const reviewPolicy = toReviewPolicy(it.reviewPolicy);
    if (!userId || !checkpointId || daysOfWeek.length === 0) continue;

    await prisma.schedule.create({
      data: {
        userId,
        checkpointId,
        daysOfWeek,
        startTime,
        note,
        reviewPolicy,
      },
    });
    created++;
  }

  revalidatePath("/admin/assignments");
  return { ok: true, created };
}

export async function deleteSchedule(formData: FormData) {
  await assertCanAssign();
  const id = String(formData.get("id"));
  await prisma.schedule.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/assignments");
}

// ---------- แจ้งปัญหา (ซ่อม/ของหมด) ----------
export async function updateIssueStatus(formData: FormData) {
  await assertAdmin();
  const me = await currentUser();
  const id = String(formData.get("id"));
  const status = String(formData.get("status") || "");
  const resolveNote = String(formData.get("resolveNote") || "").trim() || null;
  if (status !== "OPEN" && status !== "IN_PROGRESS" && status !== "RESOLVED") {
    return;
  }
  const resolved = status === "RESOLVED";
  await prisma.issue
    .update({
      where: { id },
      data: {
        status,
        resolveNote,
        resolvedAt: resolved ? new Date() : null,
        resolvedById: resolved ? me?.id ?? null : null,
      },
    })
    .catch(() => {});
  revalidatePath("/admin/issues");
}

// ฝ่ายที่รับผิดชอบ "รับเรื่อง" ของหมด → กำลังดำเนินการ (OPEN → IN_PROGRESS)
export async function acceptSupplyIssue(
  formData: FormData
): Promise<ActionResult> {
  const me = await currentUser();
  if (!me) return { ok: false, error: "กรุณาเข้าสู่ระบบ" };

  const issueId = String(formData.get("issueId") || "");
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    include: { checkpoint: { select: { departmentId: true } } },
  });
  if (!issue || issue.type !== "SUPPLY") {
    return { ok: false, error: "ไม่พบรายการของหมดนี้" };
  }
  if (issue.status !== "OPEN") {
    return { ok: false, error: "รายการนี้ถูกรับเรื่องไปแล้ว" };
  }
  // สิทธิ์: สมาชิกฝ่ายที่รับผิดชอบ หรือ ADMIN
  const meDb = await prisma.user.findUnique({
    where: { id: me.id },
    select: { departmentId: true },
  });
  if (
    me.role !== "ADMIN" &&
    (!meDb?.departmentId ||
      meDb.departmentId !== issue.checkpoint.departmentId)
  ) {
    return { ok: false, error: "เฉพาะฝ่ายที่รับผิดชอบเท่านั้นที่รับเรื่องได้" };
  }

  await prisma.issue.update({
    where: { id: issueId },
    data: {
      status: "IN_PROGRESS",
      acceptedById: me.id,
      acceptedAt: new Date(),
    },
  });

  revalidatePath(`/issues/${issueId}`);
  revalidatePath("/admin/issues");
  return { ok: true };
}

export async function deleteIssue(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id"));
  await prisma.issue.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/issues");
}

// ---------- workflow ซ่อม: เสนอราคา / ผู้บริหารเลือก ----------

// คนในฝ่ายที่รับผิดชอบ (หรือแอดมิน) เสนอราคาซ่อม → แจ้งผู้บริหาร
export async function createRepairProposal(
  formData: FormData
): Promise<ActionResult> {
  const me = await currentUser();
  if (!me) return { ok: false, error: "กรุณาเข้าสู่ระบบ" };

  const issueId = String(formData.get("issueId") || "");
  const technician = String(formData.get("technician") || "").trim();
  const price = Number(String(formData.get("price") || "").replace(/,/g, ""));
  const startStr = String(formData.get("startDate") || "");
  const finishStr = String(formData.get("finishDate") || "");
  const detail = String(formData.get("detail") || "").trim() || null;
  const attachments = formData
    .getAll("attachments")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, 10); // กันแนบเยอะเกิน

  if (!issueId || !technician || !Number.isFinite(price) || price < 0) {
    return { ok: false, error: "กรุณากรอกชื่อช่างและราคาให้ถูกต้อง" };
  }

  const attachmentPaths: string[] = [];
  for (const f of attachments)
    attachmentPaths.push(await saveUpload(f, "proposals"));

  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    include: { checkpoint: { include: { site: true } } },
  });
  if (!issue || issue.type !== "REPAIR") {
    return { ok: false, error: "ไม่พบงานซ่อมนี้" };
  }
  // สิทธิ์: คนในฝ่ายที่รับผิดชอบ หรือ ADMIN (departmentId ไม่มีใน session → ดึงจาก DB)
  const meDb = await prisma.user.findUnique({
    where: { id: me.id },
    select: { departmentId: true },
  });
  if (
    me.role !== "ADMIN" &&
    (!meDb?.departmentId ||
      meDb.departmentId !== issue.checkpoint.departmentId)
  ) {
    return { ok: false, error: "เฉพาะฝ่ายที่รับผิดชอบเท่านั้นที่เสนอราคาได้" };
  }

  await prisma.repairProposal.create({
    data: {
      issueId,
      proposedById: me.id,
      technician,
      price,
      startDate: startStr ? new Date(`${startStr}T00:00:00`) : null,
      finishDate: finishStr ? new Date(`${finishStr}T00:00:00`) : null,
      detail,
      attachmentPaths,
    },
  });
  if (issue.status === "OPEN") {
    await prisma.issue.update({
      where: { id: issueId },
      data: { status: "PROPOSED" },
    });
  }

  // แจ้งผู้บริหาร (ADMIN + EXECUTIVE ที่ผูก LINE)
  try {
    const execs = await prisma.user.findMany({
      where: {
        role: { in: ["ADMIN", "EXECUTIVE"] },
        active: true,
        lineUserId: { not: null },
      },
      select: { lineUserId: true },
    });
    const msg = buildProposalMessage({
      checkpointName: issue.checkpoint.name,
      siteName: issue.checkpoint.site.name,
      proposerName: me.name ?? "พนักงาน",
      technician,
      price,
      dateStr: fmtDateTime(new Date()),
    });
    for (const e of execs) if (e.lineUserId) await pushMessage(e.lineUserId, [msg]);
  } catch (e) {
    console.error("[line] proposal:", e);
  }

  revalidatePath(`/issues/${issueId}`);
  revalidatePath("/issues"); // แดชบอร์ดผู้บริหาร — งานเพิ่งเข้าคิว "รอคุณเลือก"
  revalidatePath("/admin/issues");
  revalidatePath("/admin/repairs");
  return { ok: true };
}

// ผู้บริหารเลือกข้อเสนอ → อนุมัติ + แจ้งฝ่ายที่รับผิดชอบทุกคน
export async function selectRepairProposal(
  formData: FormData
): Promise<ActionResult> {
  const me = await currentUser();
  if (!me || me.role !== "EXECUTIVE") {
    return { ok: false, error: "เฉพาะผู้บริหารเลือกข้อเสนอได้" };
  }
  const proposalId = String(formData.get("proposalId") || "");
  const prop = await prisma.repairProposal.findUnique({
    where: { id: proposalId },
    include: {
      issue: { include: { checkpoint: { include: { site: true } } } },
      proposedBy: { select: { name: true } },
    },
  });
  if (!prop) return { ok: false, error: "ไม่พบข้อเสนอ" };
  if (prop.issue.type !== "REPAIR") {
    return { ok: false, error: "รายการนี้ไม่ใช่งานซ่อม" };
  }
  const issueId = prop.issueId;

  // บังคับสถานะใน WHERE ของ updateMany (ไม่ใช่ if ก่อน transaction) — กัน 2 คน/2 แท็บ
  // กดพร้อมกันแล้วอนุมัติซ้ำ + ยิง LINE ซ้ำ · ไม่มี action ถอนอนุมัติ = พลาดแล้วกู้ไม่ได้
  try {
    await prisma.$transaction(async (tx) => {
      const r = await tx.issue.updateMany({
        where: { id: issueId, status: "PROPOSED" },
        data: {
          status: "APPROVED",
          approvedById: me.id,
          approvedAt: new Date(),
        },
      });
      if (r.count === 0) throw new Error("STALE");
      await tx.repairProposal.updateMany({
        where: { issueId },
        data: { selected: false },
      });
      await tx.repairProposal.update({
        where: { id: proposalId },
        data: { selected: true },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "STALE") {
      return {
        ok: false,
        error: "งานนี้ถูกอนุมัติไปแล้ว หรือสถานะเปลี่ยนแล้ว — รีเฟรชหน้าอีกครั้ง",
      };
    }
    throw e;
  }

  // แจ้งฝ่ายที่รับผิดชอบทุกคน
  try {
    const deptId = prop.issue.checkpoint.departmentId;
    const members = deptId
      ? await prisma.user.findMany({
          where: {
            departmentId: deptId,
            active: true,
            lineUserId: { not: null },
          },
          select: { lineUserId: true },
        })
      : [];
    const msg = buildRepairApprovedMessage({
      checkpointName: prop.issue.checkpoint.name,
      siteName: prop.issue.checkpoint.site.name,
      proposerName: prop.proposedBy.name,
      technician: prop.technician,
      price: prop.price,
      detail: prop.detail,
    });
    for (const m of members) if (m.lineUserId) await pushMessage(m.lineUserId, [msg]);
  } catch (e) {
    console.error("[line] approve:", e);
  }

  revalidatePath(`/issues/${issueId}`);
  revalidatePath("/issues"); // แดชบอร์ดผู้บริหาร (หน้าที่กดปุ่ม)
  revalidatePath("/admin/issues");
  revalidatePath("/admin/repairs"); // KPI รอผู้บริหารเลือก + งบที่อนุมัติ
  return { ok: true };
}
