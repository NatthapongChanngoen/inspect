import Link from "next/link";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import LocationPicker from "@/components/LocationPicker";
import CheckpointActions from "@/components/CheckpointActions";
import { createCheckpoint } from "../actions";

export const dynamic = "force-dynamic";

export default async function CheckpointsPage() {
  const [sites, checkpoints] = await Promise.all([
    prisma.site.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.checkpoint.findMany({
      include: { site: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

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
        <form action={createCheckpoint} className="card p-4 space-y-3">
          <div className="font-semibold">เพิ่มจุดเช็คอินใหม่</div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">สถานที่</label>
              <select name="siteId" className="input" required>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">ชื่อจุด</label>
              <input name="name" className="input" required placeholder="เช่น ห้องน้ำชั้น 1" />
            </div>
            <div>
              <label className="label">รายละเอียดงาน</label>
              <input name="description" className="input" />
            </div>
          </div>

          <LocationPicker />

          <button className="btn-primary">เพิ่มจุดเช็คอิน</button>
        </form>
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
              <div className="text-xs text-gray-400 mt-1">
                {cp.latitude.toFixed(5)}, {cp.longitude.toFixed(5)} · รัศมี{" "}
                {cp.radiusMeters} ม.
              </div>
              <div className="mt-2">
                <Link
                  href={`/admin/checkpoints/${cp.id}/qr`}
                  className="text-brand text-sm font-medium"
                >
                  พิมพ์ QR
                </Link>
              </div>
              <CheckpointActions id={cp.id} name={cp.name} active={cp.active} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
