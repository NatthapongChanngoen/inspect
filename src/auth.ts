import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { authConfig } from "@/auth.config";
import { verifyLineIdToken } from "@/lib/line";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: { label: "ชื่อผู้ใช้", type: "text" },
        password: { label: "รหัสผ่าน", type: "password" },
      },
      async authorize(credentials) {
        const username = credentials?.username as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!username || !password) return null;

        const user = await prisma.user.findUnique({ where: { username } });
        if (!user || !user.active) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          name: user.name,
          role: user.role,
        };
      },
    }),
    // ล็อกอินผ่าน LINE (LIFF) — ใช้ idToken จาก liff.getIDToken()
    Credentials({
      id: "line",
      name: "LINE",
      credentials: { idToken: {} },
      async authorize(credentials) {
        const idToken = credentials?.idToken as string | undefined;
        if (!idToken) return null;

        const profile = await verifyLineIdToken(idToken);
        if (!profile) return null;

        const user = await prisma.user.findUnique({
          where: { lineUserId: profile.lineUserId },
        });
        if (!user || !user.active) return null;

        return {
          id: user.id,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
});
