"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateDepartment,
  toggleDepartmentActive,
  deleteDepartment,
} from "@/app/admin/actions";

export type DepartmentItem = {
  id: string;
  name: string;
  active: boolean;
  checkpointCount: number;
};

export default function DepartmentManager({
  departments,
}: {
  departments: DepartmentItem[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function startEdit(d: DepartmentItem) {
    setError("");
    setEditingId(d.id);
    setEditName(d.name);
  }

  function save(id: string) {
    setError("");
    startTransition(async () => {
      const res = await updateDepartment(id, editName);
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
      await toggleDepartmentActive(id);
      router.refresh();
    });
  }

  function remove(d: DepartmentItem) {
    setError("");
    if (
      !confirm(
        `ลบฝ่าย "${d.name}" ?\n(จุดเช็คอินในฝ่ายนี้จะถูกปลดออกจากฝ่าย ไม่ถูกลบ)`
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteDepartment(d.id);
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
        {departments.length === 0 && (
          <div className="p-4 text-center text-gray-500 text-sm">ยังไม่มีฝ่าย</div>
        )}

        {departments.map((d) =>
          editingId === d.id ? (
            <div key={d.id} className="p-3 space-y-2">
              <input
                className="input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="ชื่อฝ่าย"
              />
              <div className="flex gap-2">
                <button
                  className="btn-primary !py-1.5 text-sm"
                  disabled={pending}
                  onClick={() => save(d.id)}
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
              key={d.id}
              className="p-3 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="font-medium">
                  {d.name}{" "}
                  {!d.active && (
                    <span className="badge bg-gray-200 text-gray-600">ปิดใช้งาน</span>
                  )}
                </div>
                <div className="text-xs text-gray-400">{d.checkpointCount} จุด</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  className="text-brand text-sm"
                  disabled={pending}
                  onClick={() => startEdit(d)}
                >
                  แก้ไข
                </button>
                <button
                  className="text-gray-500 text-sm"
                  disabled={pending}
                  onClick={() => toggle(d.id)}
                >
                  {d.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                </button>
                <button
                  className="text-red-600 text-sm"
                  disabled={pending}
                  onClick={() => remove(d)}
                >
                  ลบ
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
