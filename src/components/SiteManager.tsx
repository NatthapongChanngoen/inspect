"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSite, toggleSiteActive, deleteSite } from "@/app/admin/actions";

export type SiteItem = {
  id: string;
  name: string;
  address: string | null;
  active: boolean;
  checkpointCount: number;
};

export default function SiteManager({
  sites,
  canDelete = true,
}: {
  sites: SiteItem[];
  // ผู้สั่งงานแก้สถานที่ได้ แต่ลบไม่ได้
  // (ลบสถานที่ = จุดเช็คอิน + งานมอบหมาย + งานประจำ + ใบแจ้งซ่อม + ข้อเสนอ หายทั้งโซ่)
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function startEdit(s: SiteItem) {
    setError("");
    setEditingId(s.id);
    setEditName(s.name);
    setEditAddress(s.address ?? "");
  }

  function save(id: string) {
    setError("");
    startTransition(async () => {
      const res = await updateSite(id, editName, editAddress);
      if (!res.ok) {
        setError(res.error || "บันทึกไม่สำเร็จ");
        return;
      }
      setEditingId(null);
      router.refresh();
    });
  }

  function toggle(id: string) {
    setError("");
    startTransition(async () => {
      await toggleSiteActive(id);
      router.refresh();
    });
  }

  function remove(s: SiteItem) {
    setError("");
    if (
      !confirm(
        `ลบสถานที่ "${s.name}" ?\n(จุดเช็คอินและงานที่มอบหมายของสถานที่นี้จะถูกลบด้วย)`
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteSite(s.id);
      if (!res.ok) {
        setError(res.error || "ลบไม่สำเร็จ");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>
      )}

      <div className="card divide-y">
        {sites.length === 0 && (
          <div className="p-4 text-center text-gray-500 text-sm">ยังไม่มีสถานที่</div>
        )}

        {sites.map((s) =>
          editingId === s.id ? (
            <div key={s.id} className="p-3 space-y-2">
              <div className="grid sm:grid-cols-2 gap-2">
                <input
                  className="input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="ชื่อสถานที่"
                />
                <input
                  className="input"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  placeholder="ที่อยู่"
                />
              </div>
              <div className="flex gap-2">
                <button
                  className="btn-primary !py-1.5 text-sm"
                  disabled={pending}
                  onClick={() => save(s.id)}
                >
                  บันทึก
                </button>
                <button
                  className="btn-ghost !py-1.5 text-sm"
                  disabled={pending}
                  onClick={() => setEditingId(null)}
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          ) : (
            <div
              key={s.id}
              className="p-3 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="font-medium">
                  {s.name}{" "}
                  {!s.active && (
                    <span className="badge bg-gray-200 text-gray-600">ปิดใช้งาน</span>
                  )}
                </div>
                {s.address && (
                  <div className="text-sm text-gray-500 truncate">{s.address}</div>
                )}
                <div className="text-xs text-gray-400">{s.checkpointCount} จุด</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  className="text-brand text-sm"
                  disabled={pending}
                  onClick={() => startEdit(s)}
                >
                  แก้ไข
                </button>
                <button
                  className="text-gray-500 text-sm"
                  disabled={pending}
                  onClick={() => toggle(s.id)}
                >
                  {s.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                </button>
                {canDelete && (
                  <button
                    className="text-red-600 text-sm"
                    disabled={pending}
                    onClick={() => remove(s)}
                  >
                    ลบ
                  </button>
                )}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
