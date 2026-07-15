import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { createSite } from "../actions";
import SiteManager from "@/components/SiteManager";

export const dynamic = "force-dynamic";

export default async function SitesPage() {
  const [sites, me] = await Promise.all([
    prisma.site.findMany({
      include: { _count: { select: { checkpoints: true } } },
      orderBy: { createdAt: "asc" },
    }),
    currentUser(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">สถานที่</h1>

      <form action={createSite} className="card p-4 space-y-3">
        <div className="font-semibold">เพิ่มสถานที่ใหม่</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">ชื่อสถานที่ / อาคาร</label>
            <input name="name" className="input" required />
          </div>
          <div>
            <label className="label">ที่อยู่</label>
            <input name="address" className="input" />
          </div>
        </div>
        <button className="btn-primary">เพิ่มสถานที่</button>
      </form>

      <SiteManager
        canDelete={me?.role === "ADMIN"}
        sites={sites.map((s) => ({
          id: s.id,
          name: s.name,
          address: s.address,
          active: s.active,
          checkpointCount: s._count.checkpoints,
        }))}
      />
    </div>
  );
}
