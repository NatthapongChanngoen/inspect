import Header from "@/components/Header";
import { currentUser } from "@/lib/session";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  return (
    <div className="min-h-screen">
      <Header name={user?.name} role={user?.role ?? "STAFF"} homeHref="/staff" />
      <main className="max-w-3xl mx-auto p-4">{children}</main>
    </div>
  );
}
