"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  toggleCheckpointActiveById,
  deleteCheckpoint,
} from "@/app/admin/actions";

export default function CheckpointActions({
  id,
  name,
  active,
  canDelete = true,
}: {
  id: string;
  name: string;
  active: boolean;
  canDelete?: boolean; // ผู้สั่งงานแก้จุดได้ แต่ลบไม่ได้ (ลบจุด = งาน/ใบแจ้งซ่อมหายทั้งโซ่)
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function toggle() {
    setError("");
    startTransition(async () => {
      await toggleCheckpointActiveById(id);
      router.refresh();
    });
  }

  function remove() {
    setError("");
    if (
      !confirm(
        `ลบจุด "${name}" ?\n(งานที่มอบหมายของจุดนี้จะถูกลบด้วย)`
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteCheckpoint(id);
      if (!res.ok) {
        setError(res.error || "ลบไม่สำเร็จ");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-2">
      <div className="flex gap-3">
        <button
          className="text-gray-500 text-sm"
          disabled={pending}
          onClick={toggle}
        >
          {active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
        </button>
        {canDelete && (
          <button
            className="text-red-600 text-sm"
            disabled={pending}
            onClick={remove}
          >
            ลบ
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
