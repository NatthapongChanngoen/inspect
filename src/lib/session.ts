import { auth } from "@/auth";

export type SessionUser = {
  id: string;
  name?: string | null;
  role: "STAFF" | "INSPECTOR" | "ADMIN" | "EXECUTIVE";
};

export async function currentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  return session.user as SessionUser;
}
