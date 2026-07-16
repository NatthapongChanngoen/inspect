import Link from "next/link";
import { User } from "lucide-react";
import LogoutButton from "./LogoutButton";
import { CheckIcon } from "./Icons";
import { ROLE_LABELS as roleLabel } from "@/lib/permissions";

export default function Header({
  name,
  role,
  homeHref,
}: {
  name?: string | null;
  role: string;
  homeHref: string;
}) {
  return (
    <header className="bg-gradient-to-r from-brand-dark to-brand text-white sticky top-0 z-30 shadow-md">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href={homeHref} className="flex items-center gap-2 font-bold text-lg">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/20">
            <CheckIcon size={18} />
          </span>
          ระบบตรวจงาน
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            className="flex items-center gap-2.5 hover:opacity-90"
          >
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/20 ring-1 ring-white/30">
              <User size={18} />
            </span>
            <div className="leading-tight">
              <div className="text-sm font-medium">{name}</div>
              <div className="text-xs text-white/80">
                {roleLabel[role] ?? role}
              </div>
            </div>
          </Link>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
