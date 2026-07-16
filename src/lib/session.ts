import { auth } from "@/auth";
import type { AppRole } from "@/lib/permissions";

export type SessionUser = {
  id: string;
  name?: string | null;
  role: AppRole;
};

export async function currentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  return session.user as SessionUser;
}
