"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { changeOwnPassword } from "@/app/profile/actions";

type ActionResult = { ok: boolean; error?: string };

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "กำลังบันทึก…" : "เปลี่ยนรหัสผ่าน"}
    </button>
  );
}

export default function ChangePasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    changeOwnPassword,
    null
  );

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="card p-4 space-y-3">
      <div className="font-semibold">เปลี่ยนรหัสผ่าน</div>
      <div>
        <label className="label">รหัสผ่านเดิม</label>
        <input name="current" type="password" className="input" required />
      </div>
      <div>
        <label className="label">รหัสผ่านใหม่</label>
        <input name="next" type="password" className="input" required />
      </div>
      <div>
        <label className="label">ยืนยันรหัสผ่านใหม่</label>
        <input name="confirm" type="password" className="input" required />
      </div>

      {state && !state.ok && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2.5">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="text-sm text-green-700 bg-green-50 rounded-lg p-2.5">
          เปลี่ยนรหัสผ่านเรียบร้อยแล้ว
        </p>
      )}

      <SubmitBtn />
    </form>
  );
}
