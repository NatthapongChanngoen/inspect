// ตัดสินใจว่าข้อความที่พิมพ์เข้า OA ควรตอบด้วยการ์ดไหน
// แยกออกมาจาก webhook เพราะ "ลำดับการเช็ค" มีกับดัก และต้องทดสอบได้
export type ReplyKind = "work" | "welcome" | "admin" | "report" | "issue";

// คำที่ทำให้แสดงเมนูต้อนรับ (นอกจากนี้จะเงียบ — ไม่ตอบทุกข้อความ)
const MENU_KEYWORDS = ["เมนู", "menu", "เริ่ม", "start", "สวัสดี", "hello", "hi"];

// null = ไม่ตรง trigger → เงียบ ไม่ตอบ
export function classifyMessage(
  text: string,
  isFollow = false
): ReplyKind | null {
  if (isFollow) return "welcome"; // แอดเพื่อนครั้งแรก
  const t = text.trim();
  const lower = t.toLowerCase();

  // ⚠️ ลำดับสำคัญมาก — คำที่ยาวกว่า/เฉพาะเจาะจงกว่าต้องมาก่อน
  //    "รายงาน".includes("งาน") = true → ถ้าเช็ค "งาน" ก่อน จะไม่มีวันได้การ์ดรายงาน
  //    "แจ้งซ่อมงานที่จุด A" ก็มี "งาน" เหมือนกัน → ต้องเช็ค "แจ้งซ่อม" ก่อน
  if (lower.includes("admin")) return "admin";
  if (t.includes("รายงาน")) return "report";
  if (t.includes("แจ้งซ่อม") || t.includes("ของหมด")) return "issue";
  if (t.includes("งาน")) return "work";
  if (MENU_KEYWORDS.some((k) => lower.includes(k))) return "welcome";
  return null;
}
