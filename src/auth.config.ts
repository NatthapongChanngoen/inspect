import type { NextAuthConfig } from "next-auth";
import type { AppRole } from "@/lib/permissions";

// ส่วน config ที่ปลอดภัยกับ Edge runtime (ไม่มี prisma / bcrypt)
// ใช้ร่วมกันทั้ง middleware และ instance หลัก
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  trustHost: true,
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = (user.id as string) ?? token.id;
        token.role = user.role ?? "STAFF";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as AppRole;
      }
      return session;
    },
  },
  providers: [], // เติม Credentials provider ใน auth.ts (ฝั่ง Node)
} satisfies NextAuthConfig;
