import Link from "next/link";
import Header from "@/components/Header";
import { currentUser } from "@/lib/session";
import { ArrowRightIcon } from "@/components/Icons";

export default async function InspectorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  return (
    <div className="min-h-screen">
      <Header
        name={user?.name}
        role={user?.role ?? "INSPECTOR"}
        homeHref="/inspector"
      />
      <main className="max-w-3xl mx-auto p-4">
        {user?.role === "ADMIN" && (
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-dark mb-4 hover:gap-2.5 transition-all"
          >
            <ArrowRightIcon size={16} className="rotate-180" />
            กลับแดชบอร์ดผู้ดูแล
          </Link>
        )}
        {children}
      </main>
    </div>
  );
}
