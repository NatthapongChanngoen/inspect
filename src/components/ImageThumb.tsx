"use client";

import { useState } from "react";

// รูปย่อ (thumbnail) กดแล้วเปิดดูรูปใหญ่เต็มจอ
export default function ImageThumb({
  src,
  alt,
  thumbClassName = "h-28 w-28 rounded-lg border object-cover bg-gray-50 cursor-zoom-in hover:opacity-90 transition",
}: {
  src: string;
  alt: string;
  thumbClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className={thumbClassName} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
          onClick={() => setOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain cursor-zoom-out"
          />
        </div>
      )}
    </>
  );
}
