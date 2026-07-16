"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createRepairProposal } from "@/app/admin/actions";

type Result = { ok: boolean; error?: string };

export default function RepairProposalForm({ issueId }: { issueId: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    async (_prev: Result, fd: FormData) => createRepairProposal(fd),
    { ok: false }
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="issueId" value={issueId} />
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="label">ชื่อช่าง</label>
          <input name="technician" className="input" required placeholder="เช่น ช่างสมศักดิ์" />
        </div>
        <div>
          <label className="label">ราคา (บาท)</label>
          <input name="price" className="input" inputMode="numeric" required placeholder="1800" />
        </div>
        <div>
          <label className="label">วันที่เข้าซ่อม</label>
          <input type="date" name="startDate" className="input" />
        </div>
        <div>
          <label className="label">จะเสร็จวันที่</label>
          <input type="date" name="finishDate" className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">รายละเอียด</label>
          <input name="detail" className="input" placeholder="วิธีซ่อม / อะไหล่ / การรับประกัน" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">เอกสารแนบ (ถ้ามี)</label>
          <input
            type="file"
            name="attachments"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,image/*"
            multiple
            className="input"
          />
          <p className="text-xs text-gray-400 mt-1">
            เช่น ใบเสนอราคา (PDF/Word/Excel) หรือรูปภาพ — แนบได้หลายไฟล์
          </p>
        </div>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className="btn-primary" disabled={pending}>
        {pending ? "กำลังบันทึก…" : "＋ เพิ่มข้อเสนอ"}
      </button>
    </form>
  );
}
