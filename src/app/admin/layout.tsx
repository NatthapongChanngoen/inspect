import AdminNav from "@/components/AdminNav";
import AdminTopbar from "@/components/AdminTopbar";
import { currentUser } from "@/lib/session";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  return (
    <div className="md:flex min-h-screen">
      <AdminNav role={user?.role ?? "ADMIN"} />
      <div className="flex-1 min-w-0 flex flex-col">
        <AdminTopbar name={user?.name} role={user?.role ?? "ADMIN"} />
        <main className="flex-1 min-w-0 p-4 md:p-6 max-w-6xl w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
