"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteUser } from "@/app/admin/actions";

export default function DeleteUserButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function remove() {
    setError("");
    if (!confirm(`ลบผู้ใช้ "${name}" ?`)) return;
    startTransition(async () => {
      const res = await deleteUser(id);
      if (!res.ok) {
        setError(res.error || "ลบไม่สำเร็จ");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end">
      <button
        className="btn-ghost !py-1.5 text-sm !text-red-600 !border-red-200"
        disabled={pending}
        onClick={remove}
      >
        ลบ
      </button>
      {error && (
        <p className="text-xs text-red-600 mt-1 max-w-[14rem] text-right">
          {error}
        </p>
      )}
    </div>
  );
}
