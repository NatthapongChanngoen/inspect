"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { updateUserState } from "@/app/admin/actions";

type ActionResult = { ok: boolean; error?: string };

type UserItem = {
  id: string;
  name: string;
  username: string;
  phone: string | null;
  nationalId: string | null;
  role: string;
  staffType: string | null;
  departmentId: string | null;
};

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "กำลังบันทึก…" : "บันทึก"}
    </button>
  );
}

export default function EditUserModal({
  user,
  departments = [],
}: {
  user: UserItem;
  departments?: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState(user.role);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    updateUserState,
    null
  );

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <>
      <button
        className="btn-ghost !py-1.5 text-sm"
        onClick={() => {
          setRole(user.role);
          setOpen(true);
        }}
      >
        แก้ไข
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => setOpen(false)}
        >
          <div
            className="card w-full max-w-md p-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-lg">แก้ไขผู้ใช้</div>
              <button
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                onClick={() => setOpen(false)}
                aria-label="ปิด"
              >
                ✕
              </button>
            </div>

            <form action={formAction} className="space-y-3">
              <input type="hidden" name="id" value={user.id} />

              <div>
                <label className="label">ชื่อ-นามสกุล</label>
                <input name="name" className="input" defaultValue={user.name} required />
              </div>
              <div>
                <label className="label">ชื่อผู้ใช้ (ล็อกอิน)</label>
                <input
                  className="input bg-gray-50 text-gray-500"
                  value={`@${user.username}`}
                  disabled
                />
              </div>
              <div>
                <label className="label">เลขบัตรประชาชน (13 หลัก)</label>
                <input
                  name="nationalId"
                  className="input"
                  inputMode="numeric"
                  maxLength={13}
                  defaultValue={user.nationalId ?? ""}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">เบอร์โทร</label>
                  <input name="phone" className="input" defaultValue={user.phone ?? ""} />
                </div>
                <div>
                  <label className="label">บทบาท</label>
                  <select
                    name="role"
                    className="input"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="STAFF">พนักงาน (แม่บ้าน/รปภ)</option>
                    <option value="INSPECTOR">ผู้ตรวจสอบ</option>
                    <option value="SUPERVISOR">ผู้สั่งงาน</option>
                    <option value="ADMIN">ผู้ดูแลระบบ</option>
                    <option value="EXECUTIVE">ผู้บริหาร</option>
                  </select>
                </div>
              </div>
              {role === "STAFF" && (
                <div>
                  <label className="label">ประเภทพนักงาน</label>
                  <select
                    name="staffType"
                    className="input"
                    defaultValue={user.staffType ?? ""}
                  >
                    <option value="">— ไม่ระบุ —</option>
                    <option value="HOUSEKEEPER">แม่บ้าน</option>
                    <option value="SECURITY">รปภ.</option>
                  </select>
                </div>
              )}
              <div>
                <label className="label">สังกัดฝ่าย (สำหรับงานซ่อม)</label>
                <select
                  name="departmentId"
                  className="input"
                  defaultValue={user.departmentId ?? ""}
                >
                  <option value="">— ไม่ระบุ —</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {state && !state.ok && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2.5">
                  {state.error}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setOpen(false)}
                >
                  ยกเลิก
                </button>
                <SubmitBtn />
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
