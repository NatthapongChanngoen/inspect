// ตรวจสอบ LINE ID Token กับ LINE แล้วคืนข้อมูลผู้ใช้ไลน์
const CHANNEL_ID = process.env.LINE_LOGIN_CHANNEL_ID;

export type LineProfile = {
  lineUserId: string;
  name?: string;
  picture?: string;
};

export async function verifyLineIdToken(
  idToken: string
): Promise<LineProfile | null> {
  if (!idToken || !CHANNEL_ID) return null;
  try {
    const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: idToken, client_id: CHANNEL_ID }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      sub?: string;
      name?: string;
      picture?: string;
    };
    if (!data.sub) return null;
    return { lineUserId: data.sub, name: data.name, picture: data.picture };
  } catch {
    return null;
  }
}
