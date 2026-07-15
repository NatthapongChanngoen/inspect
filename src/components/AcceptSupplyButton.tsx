"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptSupplyIssue } from "@/app/admin/actions";

export default function AcceptSupplyButton({ issueId }: { issueId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  return (
    <div className="space-y-2">
      <button
        className="btn-primary btn-lg w-full"
        disabled={pending}
        onClick={() => {
          setError("");
          const fd = new FormData();
          fd.set("issueId", issueId);
          start(async () => {
            const res = await acceptSupplyIssue(fd);
            if (res?.ok) router.refresh();
            else setError(res?.error || "รับเรื่องไม่สำเร็จ");
          });
        }}
      >
        {pending ? "กำลังรับเรื่อง…" : "📥 รับเรื่อง (ดำเนินการเติมของ)"}
      </button>
      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2.5">{error}</p>
      )}
    </div>
  );
}
