// แหล่งความจริงเดียวเรื่องบทบาท/สิทธิ์เข้าหน้า
// ก่อนหน้านี้ allowlist กระจายอยู่ 2 ที่ (AdminNav กับ middleware) และไม่ตรงกัน
// → ทุกที่ต้องอ่านจากไฟล์นี้เท่านั้น
// ไฟล์นี้ต้องไม่ import prisma/bcrypt — middleware รันบน Edge runtime

export type AppRole =
  | "STAFF"
  | "INSPECTOR"
  | "ADMIN"
  | "EXECUTIVE"
  | "SUPERVISOR";

export const ROLE_LABELS: Record<string, string> = {
  STAFF: "พนักงาน",
  INSPECTOR: "ผู้ตรวจสอบ",
  ADMIN: "ผู้ดูแลระบบ",
  EXECUTIVE: "ผู้บริหาร",
  SUPERVISOR: "ผู้สั่งงาน",
};

// path ใน /admin ที่ผู้บริหารเข้าได้ (ดูรายงานอย่างเดียว)
const EXEC_PATHS = ["/admin/executive", "/admin/reports", "/admin/repairs"];

// path ใน /admin ที่ผู้สั่งงานเข้าได้ (มอบหมายงาน + จัดการสถานที่/จุด)
const SUPERVISOR_PATHS = ["/admin/sites", "/admin/checkpoints", "/admin/assignments"];

// หน้าแรกตามบทบาท (ใช้ทั้ง middleware และหน้าโปรไฟล์)
export function homeFor(role?: string): string {
  if (role === "ADMIN") return "/admin";
  if (role === "EXECUTIVE") return "/admin/executive";
  if (role === "SUPERVISOR") return "/admin/assignments";
  if (role === "INSPECTOR") return "/inspector";
  return "/staff";
}

// เข้า path ใน /admin ได้มั้ย (ใช้ที่ middleware — นี่คือด่านจริง)
export function canAccessAdminPath(role: string | undefined, path: string): boolean {
  if (role === "ADMIN") return true;
  if (role === "EXECUTIVE") return EXEC_PATHS.some((p) => path.startsWith(p));
  if (role === "SUPERVISOR") return SUPERVISOR_PATHS.some((p) => path.startsWith(p));
  return false;
}

// เมนูที่แต่ละบทบาทเห็นใน AdminNav — null = เห็นทุกเมนู (ADMIN)
// หมายเหตุ: nav เป็นแค่การซ่อน UI ไม่ใช่ security — ด่านจริงอยู่ที่ middleware + assert* ใน actions
export function navHrefsFor(role?: string): Set<string> | null {
  if (role === "EXECUTIVE") return new Set([...EXEC_PATHS, "/issues"]);
  if (role === "SUPERVISOR") return new Set(SUPERVISOR_PATHS);
  return null;
}

// มอบหมายงาน + จัดการสถานที่/จุด (สร้าง/แก้ ไม่รวมลบสถานที่/จุด)
export function canAssign(role?: string): boolean {
  return role === "ADMIN" || role === "SUPERVISOR";
}
