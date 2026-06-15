// ส่งข้อความแจ้งเตือน (push) เข้า LINE OA ผ่าน Messaging API
// ใช้ Channel Access Token (long-lived) จาก Messaging API channel
// ถ้าไม่ได้ตั้ง LINE_MESSAGING_TOKEN จะข้ามการส่ง (ไม่ error) — ระบบทำงานปกติ

const TOKEN = process.env.LINE_MESSAGING_TOKEN;
const LIFF_ID = process.env.LIFF_ID;

// URL เปิดแอปเราในไลน์ (LIFF) — ใช้เป็นปลายทางปุ่มในข้อความ
export function liffUrl(): string | null {
  return LIFF_ID ? `https://liff.line.me/${LIFF_ID}` : null;
}

export function lineMessagingEnabled(): boolean {
  return !!TOKEN;
}

// ส่งข้อความ (array ของ LINE message object) ไปยัง lineUserId หนึ่งคน
export async function pushMessage(
  to: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[]
): Promise<boolean> {
  if (!TOKEN) {
    console.warn("[line] ข้าม push — ยังไม่ได้ตั้ง LINE_MESSAGING_TOKEN");
    return false;
  }
  if (!to) return false;
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ to, messages }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[line] push ล้มเหลว ${res.status}: ${body}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[line] push error:", e);
    return false;
  }
}

// ---------- ตัวสร้างข้อความ ----------

// แจ้งเตือน "ได้รับงานใหม่" + ปุ่มเริ่มงาน (เปิด LIFF → หน้าเลือกงาน)
export function buildAssignmentMessage(opts: {
  staffName: string;
  checkpointName: string;
  siteName: string;
  dateStr: string;
  timeStr?: string | null;
  note?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): any {
  const url = liffUrl();
  const lines: string[] = [
    `📋 ${opts.checkpointName}`,
    `📍 ${opts.siteName}`,
    `🗓️ ${opts.dateStr}${opts.timeStr ? ` เวลา ${opts.timeStr} น.` : ""}`,
  ];
  if (opts.note) lines.push(`📝 ${opts.note}`);

  const bubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "text",
          text: "คุณได้รับงานใหม่",
          weight: "bold",
          size: "lg",
          color: "#10b981",
        },
        {
          type: "text",
          text: `คุณ ${opts.staffName}`,
          size: "sm",
          color: "#666666",
        },
        { type: "separator", margin: "md" },
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "sm",
          contents: lines.map((t) => ({
            type: "text",
            text: t,
            size: "sm",
            wrap: true,
            color: "#333333",
          })),
        },
      ],
    },
    ...(url
      ? {
          footer: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "button",
                style: "primary",
                color: "#10b981",
                action: { type: "uri", label: "เริ่มงาน", uri: url },
              },
            ],
          },
        }
      : {}),
  };

  return {
    type: "flex",
    altText: `งานใหม่: ${opts.checkpointName} (${opts.siteName})`,
    contents: bubble,
  };
}

// แจ้งเตือนผู้ตรวจ: รายการที่ต้องไปตรวจวันนี้ + ปุ่มเปิดคิวตรวจ
export function buildInspectorListMessage(opts: {
  dateStr: string;
  items: { siteName: string; checkpointName: string; staffName: string }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): any {
  const url = liffUrl();
  const itemContents =
    opts.items.length === 0
      ? [
          {
            type: "text",
            text: "วันนี้ยังไม่มีงานรอตรวจ",
            size: "sm",
            color: "#999999",
            wrap: true,
          },
        ]
      : opts.items.map((it, i) => ({
          type: "text",
          text: `${i + 1}. ${it.siteName} / ${it.checkpointName} — ${it.staffName}`,
          size: "sm",
          wrap: true,
          color: "#333333",
        }));

  const bubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "text",
          text: "รายการที่ต้องตรวจวันนี้",
          weight: "bold",
          size: "lg",
          color: "#2563eb",
        },
        { type: "text", text: opts.dateStr, size: "sm", color: "#666666" },
        { type: "separator", margin: "md" },
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "sm",
          contents: itemContents,
        },
      ],
    },
    ...(url
      ? {
          footer: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "button",
                style: "primary",
                color: "#2563eb",
                action: { type: "uri", label: "เปิดคิวตรวจ", uri: url },
              },
            ],
          },
        }
      : {}),
  };

  return {
    type: "flex",
    altText: `รายการตรวจวันนี้ (${opts.items.length} จุด)`,
    contents: bubble,
  };
}
