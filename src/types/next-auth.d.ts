import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "STAFF" | "INSPECTOR" | "ADMIN";
    } & DefaultSession["user"];
  }

  interface User {
    role?: "STAFF" | "INSPECTOR" | "ADMIN";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "STAFF" | "INSPECTOR" | "ADMIN";
  }
}
