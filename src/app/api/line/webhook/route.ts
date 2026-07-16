import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import {
  replyMessage,
  buildWelcomeMessage,
  buildWorkMenuMessage,
  buildAdminLoginMessage,
  buildReportMenuMessage,
  buildIssueMenuMessage,
} from "@/lib/lineMessaging";
import { classifyMessage } from "@/lib/lineRouting";

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

  // ตอบสำหรับ event ที่มี replyToken (พิมพ์ข้อความ / แอดเพื่อน)
  await Promise.all(
    events.map(async (ev: LineEvent) => {
      if (ev.type !== "message" && ev.type !== "follow") return;
      if (!ev.replyToken) return;

      // ข้อความที่พิมพ์มา (เฉพาะ event message แบบ text)
      const text =
        ev.type === "message" && ev.message?.type === "text"
          ? String(ev.message.text || "")
          : "";

      // ตัดสินใจว่าจะตอบอะไร (ตรรกะ + ลำดับ อยู่ที่ src/lib/lineRouting.ts)
      const kind = classifyMessage(text, ev.type === "follow");
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
      // พิมพ์ "แจ้งซ่อม"/"ของหมด" → ปุ่มแยกเรื่องที่จะแจ้ง (ไม่ต้องผูกบัญชี)
      // พิมพ์ "งาน" + ผูกบัญชีแล้ว → เมนูงาน
      // พิมพ์ "งาน" แต่ยังไม่ผูก → การ์ดต้อนรับปุ่มแยกบทบาท (ให้เข้าสู่ระบบก่อน)
      const msg =
        kind === "admin"
          ? buildAdminLoginMessage()
          : kind === "report"
            ? buildReportMenuMessage()
            : kind === "issue"
              ? buildIssueMenuMessage()
              : kind === "work" && user?.name
                ? buildWorkMenuMessage({ name: user.name })
                : buildWelcomeMessage({ name: user?.name });

      await replyMessage(ev.replyToken, [msg]);
    })
  );

  // LINE ต้องการ 200 เสมอ (verify webhook = events ว่าง ก็ตอบ 200)
  return NextResponse.json({ ok: true });
}
