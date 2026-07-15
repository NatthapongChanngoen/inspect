import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import {
  replyMessage,
  buildWelcomeMessage,
  buildWorkMenuMessage,
  buildAdminLoginMessage,
  buildReportMenuMessage,
} from "@/lib/lineMessaging";

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;

// ตรวจลายเซ็นของ LINE (x-line-signature = base64(HMAC-SHA256(secret, rawBody)))
function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!CHANNEL_SECRET || !signature) return false;
  const expected = crypto
    .createHmac("sha256", CHANNEL_SECRET)
    .update(rawBody)
    .digest("base64");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature)
    );
  } catch {
    return false;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LineEvent = any;

// Webhook ของ LINE Messaging API — ตอบกลับด้วยเมนูต้อนรับเมื่อผู้ใช้พิมพ์/แอดเพื่อน
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // ยังไม่ได้ตั้ง secret → ปิดฟีเจอร์อย่างปลอดภัย (ตอบ 200 เพื่อไม่ให้ LINE error)
  if (!CHANNEL_SECRET) {
    console.warn("[line] webhook: ยังไม่ได้ตั้ง LINE_CHANNEL_SECRET — ข้าม");
    return NextResponse.json({ ok: true });
  }

  const signature = req.headers.get("x-line-signature");
  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let events: LineEvent[] = [];
  try {
    events = JSON.parse(rawBody).events ?? [];
  } catch {
    events = [];
  }

  // ตอบเมนูต้อนรับสำหรับ event ที่มี replyToken (พิมพ์ข้อความ / แอดเพื่อน)
  // คำที่ทำให้แสดงเมนูต้อนรับ (นอกจากนี้จะเงียบ — ไม่ตอบทุกข้อความ)
  const MENU_KEYWORDS = ["เมนู", "menu", "เริ่ม", "start", "สวัสดี", "hello", "hi"];

  await Promise.all(
    events.map(async (ev: LineEvent) => {
      if (ev.type !== "message" && ev.type !== "follow") return;
      if (!ev.replyToken) return;

      // ข้อความที่พิมพ์มา (เฉพาะ event message แบบ text)
      const text = (
        ev.type === "message" && ev.message?.type === "text"
          ? String(ev.message.text || "")
          : ""
      ).trim();
      const lower = text.toLowerCase();

      // ตัดสินใจว่าจะตอบอะไร — ตอบเฉพาะ trigger ที่กำหนด ไม่ตอบทุกข้อความ
      // ⚠️ ต้องเช็ค "รายงาน" ก่อน "งาน" เพราะ "รายงาน".includes("งาน") = true
      let kind: "work" | "welcome" | "admin" | "report" | null = null;
      if (ev.type === "follow") kind = "welcome"; // แอดเพื่อนครั้งแรก
      else if (lower.includes("admin")) kind = "admin"; // พิมพ์ "admin"
      else if (text.includes("รายงาน")) kind = "report"; // พิมพ์ "รายงาน"
      else if (text.includes("งาน")) kind = "work"; // พิมพ์ "งาน"
      else if (MENU_KEYWORDS.some((k) => lower.includes(k))) kind = "welcome";

      if (!kind) return; // ไม่ตรง trigger → เงียบ (ไม่ตอบ)

      const lineUserId: string | undefined = ev.source?.userId;
      const user = lineUserId
        ? await prisma.user.findUnique({
            where: { lineUserId },
            select: { name: true },
          })
        : null;

      // พิมพ์ "admin" → ปุ่มเข้าสู่ระบบผู้ดูแลระบบ
      // พิมพ์ "รายงาน" → ปุ่มไปหน้ารายงานผู้บริหาร
      // พิมพ์ "งาน" + ผูกบัญชีแล้ว → เมนูงาน
      // พิมพ์ "งาน" แต่ยังไม่ผูก → การ์ดต้อนรับปุ่มแยกบทบาท (ให้เข้าสู่ระบบก่อน)
      const msg =
        kind === "admin"
          ? buildAdminLoginMessage()
          : kind === "report"
            ? buildReportMenuMessage()
            : kind === "work" && user?.name
              ? buildWorkMenuMessage({ name: user.name })
              : buildWelcomeMessage({ name: user?.name });

      await replyMessage(ev.replyToken, [msg]);
    })
  );

  // LINE ต้องการ 200 เสมอ (verify webhook = events ว่าง ก็ตอบ 200)
  return NextResponse.json({ ok: true });
}
