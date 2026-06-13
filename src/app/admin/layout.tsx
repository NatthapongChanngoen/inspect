import Header from "@/components/Header";
import AdminNav from "@/components/AdminNav";
import { currentUser } from "@/lib/session";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  return (
    <div className="min-h-screen flex flex-col">
      <Header name={user?.name} role={user?.role ?? "ADMIN"} homeHref="/admin" />
      <div className="w-full max-w-6xl mx-auto md:flex flex-1">
        <AdminNav />
        <main className="flex-1 min-w-0 p-4">{children}</main>
      </div>
    </div>
  );
}
