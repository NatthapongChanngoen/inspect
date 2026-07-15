"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { selectRepairProposal } from "@/app/admin/actions";

export default function SelectProposalButton({
  proposalId,
}: {
  proposalId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      className="btn-primary !py-1.5 text-sm whitespace-nowrap"
      disabled={pending}
      onClick={() => {
        if (!confirm("ยืนยันเลือกข้อเสนอนี้เพื่ออนุมัติ?")) return;
        const fd = new FormData();
        fd.set("proposalId", proposalId);
        start(async () => {
          await selectRepairProposal(fd);
          router.refresh();
        });
      }}
    >
      {pending ? "กำลังบันทึก…" : "เลือกข้อเสนอนี้"}
    </button>
  );
}
