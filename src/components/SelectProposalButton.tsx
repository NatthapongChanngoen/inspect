"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { selectRepairProposal } from "@/app/admin/actions";

// ปุ่มอนุมัติข้อเสนอ (ผู้บริหาร)
// confirmLabel = ระบุว่ากำลังอนุมัติอันไหน เช่น "ช่าง สมชาย · 12,500 ฿"
// จำเป็นบนแดชบอร์ดที่มีปุ่มหลายอันในหน้าเดียว — อนุมัติผิดแล้วถอนไม่ได้ (ไม่มี action ถอนอนุมัติ)
export default function SelectProposalButton({
  proposalId,
  confirmLabel,
}: {
  proposalId: string;
  confirmLabel?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  return (
    <div className="space-y-1.5">
      <button
        className="btn-primary !py-1.5 text-sm whitespace-nowrap"
        disabled={pending}
        onClick={() => {
          const msg = confirmLabel
            ? `ยืนยันอนุมัติข้อเสนอนี้?\n\n${confirmLabel}`
            : "ยืนยันเลือกข้อเสนอนี้เพื่ออนุมัติ?";
          if (!confirm(msg)) return;
          setError("");
          const fd = new FormData();
          fd.set("proposalId", proposalId);
          start(async () => {
            const res = await selectRepairProposal(fd);
            if (res?.ok) router.refresh();
            else setError(res?.error || "เลือกข้อเสนอไม่สำเร็จ");
          });
        }}
      >
        {pending ? "กำลังบันทึก…" : "เลือกข้อเสนอนี้"}
      </button>
      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">{error}</p>
      )}
    </div>
  );
}
