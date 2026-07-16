"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ImageThumb from "@/components/ImageThumb";
import {
  addCheckpointPhotos,
  removeCheckpointPhoto,
} from "@/app/admin/actions";

const MIN = 2;
const MAX = 5;

export default function CheckpointPhotosManager({
  checkpointId,
  photoPaths,
}: {
  checkpointId: string;
  photoPaths: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const count = photoPaths.length;
  const room = MAX - count;

  function onAdd(list: FileList | null) {
    setError("");
    if (!list || list.length === 0) return;
    const files = Array.from(list).slice(0, room);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("checkpointId", checkpointId);
      for (const f of files) fd.append("photos", f);
      const res = await addCheckpointPhotos(fd);
      if (fileRef.current) fileRef.current.value = "";
      if (!res.ok) {
        setError(res.error || "เพิ่มรูปไม่สำเร็จ");
        return;
      }
      router.refresh();
    });
  }

  function onRemove(path: string) {
    setError("");
    startTransition(async () => {
      const res = await removeCheckpointPhoto(checkpointId, path);
      if (!res.ok) {
        setError(res.error || "ลบรูปไม่สำเร็จ");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-2">
      <div className="text-xs text-gray-500 mb-1">
        รูปประจำจุด ({count}/{MAX})
      </div>
      <div className="flex flex-wrap gap-2">
        {photoPaths.map((p) => (
          <div key={p} className="relative">
            <ImageThumb
              src={`/api/files/${p}`}
              alt="รูปจุด"
              thumbClassName="h-20 w-20 rounded-lg border object-cover bg-gray-50 cursor-zoom-in hover:opacity-90 transition"
            />
            {count > MIN && (
              <button
                type="button"
                onClick={() => onRemove(p)}
                disabled={pending}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-600 text-white text-sm leading-none shadow disabled:opacity-50"
                aria-label="ลบรูป"
              >
                ×
              </button>
            )}
          </div>
        ))}
        {room > 0 && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={pending}
            className="h-20 w-20 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 text-2xl hover:border-brand hover:text-brand disabled:opacity-50"
            title={count === 0 ? `เพิ่มอย่างน้อย ${MIN} รูป` : "เพิ่มรูป"}
          >
            ＋
          </button>
        )}
      </div>
      {count > 0 && count < MIN && (
        <p className="text-xs text-amber-600 mt-1">
          ต้องมีอย่างน้อย {MIN} รูป
        </p>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onAdd(e.target.files)}
      />
    </div>
  );
}
