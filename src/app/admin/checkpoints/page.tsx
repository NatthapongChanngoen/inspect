import Link from "next/link";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import CheckpointActions from "@/components/CheckpointActions";
import CheckpointDepartmentSelect from "@/components/CheckpointDepartmentSelect";
import CheckpointCreateForm from "@/components/CheckpointCreateForm";
import CheckpointPhotosManager from "@/components/CheckpointPhotosManager";

export const dynamic = "force-dynamic";

export default async function CheckpointsPage() {
  const [sites, departments, checkpoints, me] = await Promise.all([
    prisma.site.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.checkpoint.findMany({
      include: { site: true, department: true },
      orderBy: { createdAt: "asc" },
    }),
    currentUser(),
  ]);
  const canDelete = me?.role === "ADMIN";

  const qrMap = new Map<string, string>();
  for (const cp of checkpoints) {
    qrMap.set(cp.id, await QRCode.toDataURL(cp.qrToken, { width: 160, margin: 1 }));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">จุดเช็คอิน</h1>

      {sites.length === 0 ? (
        <div className="card p-4 text-sm text-gray-500">
          กรุณาเพิ่ม “สถานที่” ก่อน จึงจะสร้างจุดเช็คอินได้
        </div>
      ) : (
        <CheckpointCreateForm
          sites={sites.map((s) => ({ id: s.id, name: s.name }))}
          departments={departments.map((d) => ({ id: d.id, name: d.name }))}
        />
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {checkpoints.map((cp) => (
          <div key={cp.id} className="card p-4 flex gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrMap.get(cp.id)} alt="QR" className="w-24 h-24" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold">
                {cp.name}{" "}
                {!cp.active && (
                  <span className="badge bg-gray-200 text-gray-600">ปิด</span>
                )}
              </div>
              <div className="text-sm text-gray-500">{cp.site.name}</div>
              <CheckpointDepartmentSelect
                checkpointId={cp.id}
                departmentId={cp.departmentId}
                departments={departments}
              />
              <CheckpointPhotosManager
                checkpointId={cp.id}
                photoPaths={cp.photoPaths}
              />
              <div className="mt-2">
                <Link
                  href={`/admin/checkpoints/${cp.id}/qr`}
                  className="text-brand text-sm font-medium"
                >
                  พิมพ์ QR
                </Link>
              </div>
              <CheckpointActions
                id={cp.id}
                name={cp.name}
                active={cp.active}
                canDelete={canDelete}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
