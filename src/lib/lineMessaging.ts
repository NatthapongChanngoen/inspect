// ส่งข้อความแจ้งเตือน (push) เข้า LINE OA ผ่าน Messaging API
// ใช้ Channel Access Token (long-lived) จาก Messaging API channel
// ถ้าไม่ได้ตั้ง LINE_MESSAGING_TOKEN จะข้ามการส่ง (ไม่ error) — ระบบทำงานปกติ

const TOKEN = process.env.LINE_MESSAGING_TOKEN;
const LIFF_ID = process.env.LIFF_ID;
const PUBLIC_BASE = process.env.PUBLIC_BASE_URL;

// URL เปิดแอปเราในไลน์ (LIFF) — ใช้เป็นปลายทางปุ่มในข้อความ
export function liffUrl(): string | null {
  return LIFF_ID ? `https://liff.line.me/${LIFF_ID}` : null;
}

// URL สาธารณะของรูปจุด (ให้ LINE ดึงไปแสดงในข้อความ) — null ถ้าไม่ได้ตั้ง PUBLIC_BASE_URL
export function checkpointPhotoUrl(checkpointId: string): string | null {
  if (!PUBLIC_BASE) return null;
  return `${PUBLIC_BASE.replace(/\/$/, "")}/api/cp-photo/${checkpointId}`;
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

// ตอบกลับข้อความ (reply API) — ใช้ replyToken จาก webhook event (ฟรี ไม่ต้องผูกบัญชีก่อน)
export async function replyMessage(
  replyToken: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[]
): Promise<boolean> {
  if (!TOKEN) {
    console.warn("[line] ข้าม reply — ยังไม่ได้ตั้ง LINE_MESSAGING_TOKEN");
    return false;
  }
  if (!replyToken) return false;
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ replyToken, messages }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[line] reply ล้มเหลว ${res.status}: ${body}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[line] reply error:", e);
    return false;
  }
}

// ข้อความต้อนรับ + เมนูปุ่มแยกตามบทบาท — ตอบเมื่อผู้ใช้พิมพ์หา OA
// ทุกปุ่มเปิดในแอป LINE (LIFF) เหมือนกัน · หน้า /line เลือกฟอร์มตาม ?role=
// แม่บ้าน/รปภ → ยืนยัน ชื่อ+เลขบัตร · ผู้ตรวจ/ผู้บริหาร → ฟอร์ม ชื่อ+รหัสผ่าน
export function buildWelcomeMessage(opts?: {
  name?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): any {
  const url = liffUrl();
  const bound = !!opts?.name;
  const subtitle = bound
    ? `ยินดีต้อนรับคุณ ${opts!.name} — เลือกบทบาทเพื่อเข้าสู่ระบบ`
    : "บัญชี LINE ของคุณยังไม่ได้ผูกกับระบบ — เลือกบทบาทของคุณเพื่อเข้าสู่ระบบ";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buttons: any[] = [];
  if (url) {
    buttons.push(
      {
        type: "button",
        style: "primary",
        color: "#10b981",
        height: "sm",
        action: { type: "uri", label: "🧹 แม่บ้าน — เข้าสู่ระบบ", uri: `${url}?role=housekeeper` },
      },
      {
        type: "button",
        style: "primary",
        color: "#10b981",
        height: "sm",
        margin: "sm",
        action: { type: "uri", label: "🛡️ รปภ. — เข้าสู่ระบบ", uri: `${url}?role=security` },
      },
      {
        type: "button",
        style: "primary",
        color: "#3b82f6",
        height: "sm",
        margin: "sm",
        action: { type: "uri", label: "✅ ผู้ตรวจ — เข้าสู่ระบบ", uri: `${url}?role=inspector` },
      },
      {
        type: "button",
        style: "primary",
        color: "#3b82f6",
        height: "sm",
        margin: "sm",
        action: { type: "uri", label: "📋 ผู้สั่งงาน — เข้าสู่ระบบ", uri: `${url}?role=supervisor` },
      },
      {
        type: "button",
        style: "primary",
        color: "#3b82f6",
        height: "sm",
        margin: "sm",
        action: { type: "uri", label: "📊 ผู้บริหาร — เข้าสู่ระบบ", uri: `${url}?role=executive` },
      },
      {
        type: "button",
        style: "secondary",
        height: "sm",
        margin: "md",
        action: { type: "uri", label: "🛠️ แจ้งซ่อม", uri: `${url}?to=report` },
      }
    );
  }

  const bubble = {
    type: "bubble",
    // หัวการ์ดสีเขียวเต็มแถบ
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#10b981",
      paddingAll: "16px",
      contents: [
        {
          type: "text",
          text: "👋 ยินดีต้อนรับสู่ ระบบตรวจงาน",
          weight: "bold",
          size: "lg",
          color: "#ffffff",
          wrap: true,
        },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        {
          type: "text",
          text: subtitle,
          size: "sm",
          color: "#555555",
          wrap: true,
        },
        ...(buttons.length
          ? [
              {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                margin: "md",
                contents: buttons,
              },
            ]
          : []),
      ],
    },
  };

  return {
    type: "flex",
    altText: "ยินดีต้อนรับสู่ ระบบตรวจงาน — เลือกบทบาทเพื่อเข้าสู่ระบบ",
    contents: bubble,
  };
}

// ตอบเมื่อพิมพ์ "admin" — ปุ่มเข้าสู่ระบบผู้ดูแลระบบ (เปิดในแอป LINE, ฟอร์มชื่อ+รหัสผ่าน)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildAdminLoginMessage(): any {
  const url = liffUrl();
  const bubble = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#334155",
      paddingAll: "16px",
      contents: [
        {
          type: "text",
          text: "🔐 เข้าสู่ระบบผู้ดูแลระบบ",
          weight: "bold",
          size: "lg",
          color: "#ffffff",
          wrap: true,
        },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        {
          type: "text",
          text: "สำหรับผู้ดูแลระบบ — เข้าสู่ระบบด้วยชื่อและรหัสผ่าน",
          size: "sm",
          color: "#555555",
          wrap: true,
        },
        ...(url
          ? [
              {
                type: "button",
                style: "primary",
                color: "#334155",
                height: "sm",
                margin: "md",
                action: {
                  type: "uri",
                  label: "🔑 เข้าสู่ระบบผู้ดูแลระบบ",
                  uri: `${url}?role=admin`,
                },
              },
            ]
          : []),
      ],
    },
  };

  return {
    type: "flex",
    altText: "เข้าสู่ระบบผู้ดูแลระบบ",
    contents: bubble,
  };
}

// ตอบเมื่อพิมพ์ "รายงาน" — ปุ่มไปหน้ารายงานผู้บริหาร (ล็อกอินผู้บริหารก่อน แล้วเด้งเข้ารายงาน)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildReportMenuMessage(): any {
  const url = liffUrl();
  const bubble = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#6366f1",
      paddingAll: "16px",
      contents: [
        {
          type: "text",
          text: "📊 รายงานผู้บริหาร",
          weight: "bold",
          size: "lg",
          color: "#ffffff",
          wrap: true,
        },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        {
          type: "text",
          text: "ดูรายงานสรุปสำหรับผู้บริหาร — เข้าสู่ระบบด้วยชื่อและรหัสผ่าน",
          size: "sm",
          color: "#555555",
          wrap: true,
        },
        ...(url
          ? [
              {
                type: "button",
                style: "primary",
                color: "#6366f1",
                height: "sm",
                margin: "md",
                action: {
                  type: "uri",
                  label: "📊 ดูรายงานผู้บริหาร",
                  uri: `${url}?role=executive&callbackUrl=%2Fadmin%2Fexecutive`,
                },
              },
            ]
          : []),
      ],
    },
  };

  return {
    type: "flex",
    altText: "รายงานผู้บริหาร",
    contents: bubble,
  };
}

// ตอบเมื่อพิมพ์ "แจ้งซ่อม" / "ของหมด" — ปุ่มแยกตามเรื่องที่จะแจ้ง
// แจ้งได้เลยไม่ต้องผูกบัญชี (ยืนยันตัวด้วย LINE idToken ที่ /api/issues/public)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildIssueMenuMessage(): any {
  const url = liffUrl();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buttons: any[] = url
    ? [
        {
          type: "button",
          style: "primary",
          color: "#10b981",
          height: "sm",
          action: {
            type: "uri",
            label: "🛠️ แจ้งซ่อมอุปกรณ์",
            uri: `${url}?to=report&type=REPAIR`,
          },
        },
        {
          type: "button",
          style: "primary",
          color: "#10b981",
          height: "sm",
          margin: "sm",
          action: {
            type: "uri",
            label: "📦 แจ้งของหมด",
            uri: `${url}?to=report&type=SUPPLY`,
          },
        },
      ]
    : [];

  const bubble = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#10b981",
      paddingAll: "16px",
      contents: [
        {
          type: "text",
          text: "🛠️ แจ้งซ่อม / ของหมด",
          weight: "bold",
          size: "lg",
          color: "#ffffff",
          wrap: true,
        },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        {
          type: "text",
          text: "เลือกเรื่องที่ต้องการแจ้ง — แจ้งผ่าน LINE ได้ทันที ไม่ต้องเข้าสู่ระบบ",
          size: "sm",
          color: "#555555",
          wrap: true,
        },
        ...(buttons.length
          ? [
              {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                margin: "md",
                contents: buttons,
              },
            ]
          : []),
      ],
    },
  };

  return {
    type: "flex",
    altText: "แจ้งซ่อม / ของหมด — เลือกเรื่องที่ต้องการแจ้ง",
    contents: bubble,
  };
}

// ตอบเมื่อพิมพ์ "งาน" — เช็คว่าผูกบัญชี LINE แล้วหรือยัง
// ผูกแล้ว → ปุ่มเปิดดูงาน · ยังไม่ผูก → ปุ่มเข้าสู่ระบบ
export function buildWorkMenuMessage(opts?: {
  name?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): any {
  const url = liffUrl();
  const bound = !!opts?.name;

  const title = bound ? "📋 งานของคุณ" : "🔒 ยังไม่ได้เชื่อมบัญชี";
  const subtitle = bound
    ? `สวัสดีคุณ ${opts!.name} — กดปุ่มด้านล่างเพื่อเปิดดูงานของคุณ`
    : "บัญชี LINE ของคุณยังไม่ได้เชื่อมกับระบบ — กรุณาเข้าสู่ระบบเพื่อผูกบัญชีก่อนใช้งาน";
  const btnLabel = bound ? "📋 เปิดงานของฉัน" : "🔑 เข้าสู่ระบบ";
  const headerColor = bound ? "#10b981" : "#f97316";

  const bubble = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: headerColor,
      paddingAll: "16px",
      contents: [
        {
          type: "text",
          text: title,
          weight: "bold",
          size: "lg",
          color: "#ffffff",
          wrap: true,
        },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        {
          type: "text",
          text: subtitle,
          size: "sm",
          color: "#555555",
          wrap: true,
        },
        ...(url
          ? [
              {
                type: "box",
                layout: "vertical",
                margin: "md",
                contents: [
                  {
                    type: "button",
                    style: "primary",
                    color: "#10b981",
                    height: "sm",
                    action: { type: "uri", label: btnLabel, uri: url },
                  },
                ],
              },
            ]
          : []),
      ],
    },
  };

  return {
    type: "flex",
    altText: bound ? "งานของคุณ — เปิดดูงาน" : "ยังไม่ได้เชื่อมบัญชี — เข้าสู่ระบบ",
    contents: bubble,
  };
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
  photoUrl?: string | null;
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
    // รูปจุด (ถ้ามี) — hero บนหัวการ์ด
    ...(opts.photoUrl
      ? {
          hero: {
            type: "image",
            url: opts.photoUrl,
            size: "full",
            aspectRatio: "20:13",
            aspectMode: "cover",
          },
        }
      : {}),
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

// แจ้งเตือน "ได้รับงานใหม่หลายงาน" รวมในข้อความเดียว + ปุ่มเริ่มงานเดียว
export function buildAssignmentBatchMessage(opts: {
  staffName: string;
  jobs: {
    checkpointName: string;
    siteName: string;
    dateStr: string;
    timeStr?: string | null;
    note?: string | null;
    photoUrl?: string | null;
  }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): any {
  const url = liffUrl();

  const jobBlocks = opts.jobs.map((j, i) => {
    const lines: string[] = [
      `📋 ${j.checkpointName}`,
      `📍 ${j.siteName}`,
      `🗓️ ${j.dateStr}${j.timeStr ? ` เวลา ${j.timeStr} น.` : ""}`,
    ];
    if (j.note) lines.push(`📝 ${j.note}`);
    const textCol = {
      type: "box",
      layout: "vertical",
      spacing: "xs",
      ...(j.photoUrl ? { flex: 1 } : {}),
      contents: [
        {
          type: "text",
          text: `งานที่ ${i + 1}`,
          size: "xs",
          weight: "bold",
          color: "#10b981",
        },
        ...lines.map((t) => ({
          type: "text",
          text: t,
          size: "sm",
          wrap: true,
          color: "#333333",
        })),
      ],
    };
    // ถ้ามีรูปจุด → แถวแนวนอน [รูปเล็ก 1:1] + [ข้อความ]
    return j.photoUrl
      ? {
          type: "box",
          layout: "horizontal",
          spacing: "md",
          ...(i > 0 ? { margin: "md" } : {}),
          contents: [
            {
              type: "image",
              url: j.photoUrl,
              size: "sm",
              aspectRatio: "1:1",
              aspectMode: "cover",
              flex: 0,
            },
            textCol,
          ],
        }
      : { ...textCol, ...(i > 0 ? { margin: "md" } : {}) };
  });

  const bubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "text",
          text: `คุณได้รับงานใหม่ ${opts.jobs.length} งาน`,
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
          contents: jobBlocks,
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
    altText: `คุณได้รับงานใหม่ ${opts.jobs.length} งาน`,
    contents: bubble,
  };
}

// แจ้งเตือน "ถึงเวลาเริ่มงาน" (ตามวัน+เวลาที่กำหนด) + ปุ่มเริ่มงาน
export function buildReminderMessage(opts: {
  staffName: string;
  jobs: {
    checkpointName: string;
    siteName: string;
    dateStr: string;
    timeStr?: string | null;
    note?: string | null;
  }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): any {
  const url = liffUrl();
  const jobBlocks = opts.jobs.map((j, i) => {
    const lines: string[] = [
      `📋 ${j.checkpointName}`,
      `📍 ${j.siteName}`,
      `🗓️ ${j.dateStr}${j.timeStr ? ` เวลา ${j.timeStr} น.` : ""}`,
    ];
    if (j.note) lines.push(`📝 ${j.note}`);
    return {
      type: "box",
      layout: "vertical",
      spacing: "xs",
      ...(i > 0 ? { margin: "md" } : {}),
      contents: [
        {
          type: "text",
          text: `งานที่ ${i + 1}`,
          size: "xs",
          weight: "bold",
          color: "#10b981",
        },
        ...lines.map((t) => ({
          type: "text",
          text: t,
          size: "sm",
          wrap: true,
          color: "#333333",
        })),
      ],
    };
  });

  const bubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "text",
          text:
            opts.jobs.length > 1
              ? `คุณได้รับงาน ${opts.jobs.length} งาน`
              : "คุณได้รับงาน",
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
          contents: jobBlocks,
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
    altText: `คุณได้รับงาน ${opts.jobs.length} งาน`,
    contents: bubble,
  };
}

// แจ้งสรุปผลตรวจให้พนักงาน (รวมหลายงานในข้อความเดียว)
export function buildReviewSummaryMessage(opts: {
  staffName: string;
  dateStr: string;
  items: {
    checkpointName: string;
    siteName: string;
    result: "PASS" | "FAIL";
    comment?: string | null;
  }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): any {
  const url = liffUrl();
  const passCount = opts.items.filter((i) => i.result === "PASS").length;
  const failCount = opts.items.length - passCount;

  const jobBlocks = opts.items.map((j, i) => {
    const pass = j.result === "PASS";
    const lines: string[] = [
      `${pass ? "✅ ผ่าน" : "❌ ไม่ผ่าน"} — ${j.siteName} · ${j.checkpointName}`,
    ];
    if (j.comment) lines.push(`📝 ${j.comment}`);
    return {
      type: "box",
      layout: "vertical",
      spacing: "xs",
      ...(i > 0 ? { margin: "md" } : {}),
      contents: lines.map((t) => ({
        type: "text",
        text: t,
        size: "sm",
        wrap: true,
        color: pass ? "#0f7a4f" : "#b3261e",
      })),
    };
  });

  const bubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "text",
          text: "ผลการตรวจงาน",
          weight: "bold",
          size: "lg",
          color: "#333333",
        },
        {
          type: "text",
          text: `คุณ ${opts.staffName} · ${opts.dateStr}`,
          size: "sm",
          color: "#666666",
        },
        {
          type: "text",
          text: `ผ่าน ${passCount} · ไม่ผ่าน ${failCount} (จาก ${opts.items.length} งาน)`,
          size: "sm",
          color: "#666666",
        },
        { type: "separator", margin: "md" },
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          contents: jobBlocks,
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
                action: { type: "uri", label: "เปิดแอป", uri: url },
              },
            ],
          },
        }
      : {}),
  };

  return {
    type: "flex",
    altText: `ผลการตรวจงาน: ผ่าน ${passCount} · ไม่ผ่าน ${failCount}`,
    contents: bubble,
  };
}

// แจ้งพนักงานทันที: งานไม่ผ่านการตรวจ + รายละเอียด
export function buildRejectedMessage(opts: {
  staffName: string;
  checkpointName: string;
  siteName: string;
  comment: string | null;
  dateStr: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): any {
  const url = liffUrl();
  const color = "#ef4444";
  const lines: string[] = [
    `📍 ${opts.siteName} · ${opts.checkpointName}`,
    `🗓️ ${opts.dateStr}`,
  ];
  if (opts.comment) lines.push(`📝 รายละเอียด: ${opts.comment}`);

  const bubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "text",
          text: "❌ งานไม่ผ่านการตรวจ",
          weight: "bold",
          size: "lg",
          color,
        },
        {
          type: "text",
          text: `คุณ ${opts.staffName}`,
          size: "sm",
          color: "#666666",
          wrap: true,
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
                color,
                action: { type: "uri", label: "เปิดแอป", uri: url },
              },
            ],
          },
        }
      : {}),
  };

  return {
    type: "flex",
    altText: `งานไม่ผ่าน: ${opts.siteName} · ${opts.checkpointName}`,
    contents: bubble,
  };
}

// สรุปรายงานผู้บริหาร (ส่งเข้า LINE)
export function buildExecutiveSummaryMessage(opts: {
  periodLabel: string;
  total: number;
  attendanceRate: number;
  passRate: number;
  missed: number;
  pending: number;
  issuesOpenNow: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): any {
  const url = liffUrl();
  const lines: string[] = [
    `📋 งานทั้งหมด ${opts.total} งาน`,
    `✅ มาปฏิบัติงาน ${opts.attendanceRate}% · ผ่านการตรวจ ${opts.passRate}%`,
    `🚫 ไม่ได้ปฏิบัติงาน ${opts.missed} · ค้างตรวจ ${opts.pending}`,
    `🛠️ แจ้งซ่อม/ของหมด ค้าง ${opts.issuesOpenNow} รายการ`,
  ];

  const bubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "text",
          text: "รายงานสรุปผู้บริหาร",
          weight: "bold",
          size: "lg",
          color: "#2563eb",
        },
        { type: "text", text: opts.periodLabel, size: "sm", color: "#666666" },
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
                color: "#2563eb",
                action: { type: "uri", label: "เปิดรายงาน", uri: url },
              },
            ],
          },
        }
      : {}),
  };

  return {
    type: "flex",
    altText: `รายงานสรุปผู้บริหาร ${opts.periodLabel}`,
    contents: bubble,
  };
}

// แจ้งพนักงาน: งานถูกตีกลับให้ทำใหม่ (จุดยังไม่สะอาด)
export function buildReturnedMessage(opts: {
  staffName: string;
  checkpointName: string;
  siteName: string;
  reason: string;
  dateStr: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): any {
  const url = liffUrl();
  const color = "#f97316";
  const lines: string[] = [
    `📍 ${opts.siteName} · ${opts.checkpointName}`,
    `📝 ${opts.reason}`,
    `🗓️ ${opts.dateStr}`,
  ];

  const bubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "text",
          text: "🔁 งานถูกตีกลับให้แก้",
          weight: "bold",
          size: "lg",
          color,
        },
        {
          type: "text",
          text: `คุณ ${opts.staffName} — กรุณาแก้แล้วส่งงานใหม่`,
          size: "sm",
          color: "#666666",
          wrap: true,
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
                color,
                action: { type: "uri", label: "แก้งาน", uri: url },
              },
            ],
          },
        }
      : {}),
  };

  return {
    type: "flex",
    altText: `งานถูกตีกลับ: ${opts.siteName} · ${opts.checkpointName}`,
    contents: bubble,
  };
}

// แจ้งเตือนแอดมิน/ผู้ตรวจ: มีการแจ้งปัญหาใหม่ (ซ่อม/ของหมด)
export function buildIssueMessage(opts: {
  type: "REPAIR" | "SUPPLY";
  checkpointName: string;
  siteName: string;
  reporterName: string;
  detail: string;
  dateStr: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): any {
  const url = liffUrl();
  const isRepair = opts.type === "REPAIR";
  const title = isRepair ? "🛠️ แจ้งซ่อมอุปกรณ์" : "📦 แจ้งของหมด";
  const color = isRepair ? "#d97706" : "#2563eb";

  const lines: string[] = [
    `📍 ${opts.siteName} · ${opts.checkpointName}`,
    `👤 แจ้งโดย ${opts.reporterName}`,
    `📝 ${opts.detail}`,
    `🗓️ ${opts.dateStr}`,
  ];

  const bubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        { type: "text", text: title, weight: "bold", size: "lg", color },
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
                color,
                action: { type: "uri", label: "เปิดแอป", uri: url },
              },
            ],
          },
        }
      : {}),
  };

  return {
    type: "flex",
    altText: `${title}: ${opts.siteName} · ${opts.checkpointName}`,
    contents: bubble,
  };
}

// แจ้งผู้บริหาร: มีข้อเสนอราคาซ่อมใหม่
export function buildProposalMessage(opts: {
  checkpointName: string;
  siteName: string;
  proposerName: string;
  technician: string;
  price: number;
  dateStr: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): any {
  const url = liffUrl();
  const color = "#d97706";
  const lines: string[] = [
    `📍 ${opts.siteName} · ${opts.checkpointName}`,
    `👤 เสนอโดย ${opts.proposerName}`,
    `🔧 ช่าง: ${opts.technician}`,
    `💰 ราคา ${opts.price.toLocaleString("th-TH")} บาท`,
    `🗓️ ${opts.dateStr}`,
  ];
  const bubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "text",
          text: "🛠️ มีข้อเสนอราคาซ่อมใหม่",
          weight: "bold",
          size: "lg",
          color,
        },
        {
          type: "text",
          text: "กรุณาพิจารณาเลือกข้อเสนอ",
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
                color,
                action: { type: "uri", label: "ดูข้อเสนอ", uri: url },
              },
            ],
          },
        }
      : {}),
  };
  return {
    type: "flex",
    altText: `ข้อเสนอซ่อม: ${opts.siteName} · ${opts.checkpointName}`,
    contents: bubble,
  };
}

// แจ้งฝ่ายรับผิดชอบ: งานซ่อมได้รับการอนุมัติ (ผู้บริหารเลือกข้อเสนอแล้ว)
export function buildRepairApprovedMessage(opts: {
  checkpointName: string;
  siteName: string;
  proposerName: string;
  technician: string;
  price: number;
  detail: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): any {
  const url = liffUrl();
  const color = "#10b981";
  const lines: string[] = [
    `📍 ${opts.siteName} · ${opts.checkpointName}`,
    `✅ เลือกข้อเสนอของ ${opts.proposerName}`,
    `🔧 ช่าง: ${opts.technician}`,
    `💰 ราคา ${opts.price.toLocaleString("th-TH")} บาท`,
  ];
  if (opts.detail) lines.push(`📝 ${opts.detail}`);
  const bubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "text",
          text: "✅ งานซ่อมได้รับการอนุมัติ",
          weight: "bold",
          size: "lg",
          color,
        },
        {
          type: "text",
          text: "ดำเนินการซ่อมได้เลย เสร็จแล้วถ่ายรูปปิดงาน",
          size: "sm",
          color: "#666666",
          wrap: true,
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
                color,
                action: { type: "uri", label: "เปิดงานซ่อม", uri: url },
              },
            ],
          },
        }
      : {}),
  };
  return {
    type: "flex",
    altText: `อนุมัติซ่อม: ${opts.siteName} · ${opts.checkpointName}`,
    contents: bubble,
  };
}

// แจ้งผู้บริหาร: งานซ่อมเสร็จแล้ว (ฝ่ายปิดงาน + แนบรูปหลักฐาน)
export function buildRepairDoneMessage(opts: {
  checkpointName: string;
  siteName: string;
  closedByName: string;
  technician: string | null;
  price: number | null;
  dateStr: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): any {
  const url = liffUrl();
  const color = "#10b981";
  const lines: string[] = [`📍 ${opts.siteName} · ${opts.checkpointName}`];
  if (opts.technician) lines.push(`🔧 ช่าง: ${opts.technician}`);
  if (opts.price != null)
    lines.push(`💰 ราคา ${opts.price.toLocaleString("th-TH")} บาท`);
  lines.push(`👤 ปิดงานโดย ${opts.closedByName}`);
  lines.push(`🗓️ ${opts.dateStr}`);

  const bubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "text",
          text: "✅ งานซ่อมเสร็จแล้ว",
          weight: "bold",
          size: "lg",
          color,
        },
        {
          type: "text",
          text: "ฝ่ายปิดงานพร้อมแนบรูปหลักฐาน",
          size: "sm",
          color: "#666666",
          wrap: true,
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
                color,
                action: { type: "uri", label: "ดูรายละเอียด", uri: url },
              },
            ],
          },
        }
      : {}),
  };
  return {
    type: "flex",
    altText: `งานซ่อมเสร็จ: ${opts.siteName} · ${opts.checkpointName}`,
    contents: bubble,
  };
}

// แจ้งเตือน "เติมของแล้ว" (ปิดงานของหมด) — ส่งให้ผู้แจ้ง + แอดมิน
export function buildSupplyRefilledMessage(opts: {
  checkpointName: string;
  siteName: string;
  detail: string;
  refilledByName: string;
  dateStr: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): any {
  const url = liffUrl();
  const color = "#10b981";
  const lines: string[] = [
    `📍 ${opts.siteName} · ${opts.checkpointName}`,
    `📦 ${opts.detail}`,
    `👤 เติมโดย ${opts.refilledByName}`,
    `🗓️ ${opts.dateStr}`,
  ];

  const bubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "text",
          text: "✅ เติมของเรียบร้อยแล้ว",
          weight: "bold",
          size: "lg",
          color,
        },
        {
          type: "text",
          text: "ฝ่ายที่รับผิดชอบเติมของและแนบรูปหลักฐานแล้ว",
          size: "sm",
          color: "#666666",
          wrap: true,
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
                color,
                action: { type: "uri", label: "ดูรายละเอียด", uri: url },
              },
            ],
          },
        }
      : {}),
  };
  return {
    type: "flex",
    altText: `เติมของแล้ว: ${opts.siteName} · ${opts.checkpointName}`,
    contents: bubble,
  };
}

// แจ้งเตือนผู้ตรวจ: รายการที่ต้องไปตรวจวันนี้ + ปุ่มเปิดคิวตรวจ
export function buildInspectorListMessage(opts: {
  dateStr: string;
  items: {
    siteName: string;
    checkpointName: string;
    staffName: string;
    timeStr?: string;
  }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): any {
  const url = liffUrl();
  const itemContents =
    opts.items.length === 0
      ? [
          {
            type: "text",
            text: "ไม่มีงานรอตรวจ",
            size: "sm",
            color: "#999999",
            wrap: true,
          },
        ]
      : opts.items.map((it, i) => ({
          type: "box",
          layout: "vertical",
          spacing: "none",
          ...(i > 0 ? { margin: "md" } : {}),
          contents: [
            {
              type: "text",
              text: `${i + 1}. ${it.siteName} / ${it.checkpointName}`,
              size: "sm",
              weight: "bold",
              wrap: true,
              color: "#333333",
            },
            {
              type: "text",
              text: `พนักงาน: ${it.staffName}${
                it.timeStr ? ` · ส่ง ${it.timeStr}` : ""
              }`,
              size: "xs",
              wrap: true,
              color: "#888888",
            },
          ],
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
          text: `รายการที่ยังไม่ได้ตรวจ ${opts.items.length} งาน`,
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
                action: { type: "uri", label: "ตรวจงาน", uri: url },
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
