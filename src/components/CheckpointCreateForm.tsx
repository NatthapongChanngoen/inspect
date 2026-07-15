"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createCheckpoint } from "@/app/admin/actions";

type Opt = { id: string; name: string };
type Pic = { file: File; url: string };

const MIN = 2;
const MAX = 5;

export default function CheckpointCreateForm({
  sites,
  departments,
}: {
  sites: Opt[];
  departments: Opt[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [departmentId, setDepartmentId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pics, setPics] = useState<Pic[]>([]);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const room = MAX - pics.length;
    const next = Array.from(list)
      .slice(0, room)
      .map((file) => ({ file, url: URL.createObjectURL(file) }));
    setPics((cur) => [...cur, ...next]);
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeAt(i: number) {
    setPics((cur) => {
      URL.revokeObjectURL(cur[i].url);
      return cur.filter((_, idx) => idx !== i);
    });
  }

  const ready =
    !!siteId &&
    !!name.trim() &&
    (departments.length === 0 || !!departmentId) &&
    pics.length >= MIN &&
    pics.length <= MAX;

  function submit() {
    setError("");
    if (pics.length < MIN) {
      setError(`กรุณาเพิ่มรูปอย่างน้อย ${MIN} รูป`);
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("siteId", siteId);
      fd.set("departmentId", departmentId);
      fd.set("name", name.trim());
      fd.set("description", description.trim());
      for (const p of pics) fd.append("photos", p.file);

      const res = await createCheckpoint(fd);
      if (!res.ok) {
        setError(res.error || "บันทึกไม่สำเร็จ");
        return;
      }
      pics.forEach((p) => URL.revokeObjectURL(p.url));
      setPics([]);
      setName("");
      setDescription("");
      setDepartmentId("");
      router.refresh();
    });
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="font-semibold">เพิ่มจุดเช็คอินใหม่</div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="label">สถานที่</label>
          <select
            className="input"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">ฝ่าย</label>
          {departments.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">
              ยังไม่มีฝ่าย —{" "}
              <Link href="/admin/departments" className="text-brand font-medium">
                เพิ่มฝ่ายก่อน
              </Link>
            </p>
          ) : (
            <select
              className="input"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="" disabled>
                — เลือกฝ่าย —
              </option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className="label">ชื่อจุด</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="เช่น ห้องน้ำชั้น 1"
          />
        </div>
        <div>
          <label className="label">รายละเอียดงาน</label>
          <input
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>

      {/* รูปประจำจุด 2-5 รูป */}
      <div>
        <label className="label">
          รูปประจำจุด ({pics.length}/{MAX}) — ต้องมี {MIN}-{MAX} รูป
        </label>
        <div className="flex flex-wrap gap-2">
          {pics.map((p, i) => (
            <div key={p.url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt=""
                className="h-24 w-24 rounded-lg border object-cover bg-gray-50"
              />
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-600 text-white text-sm leading-none shadow"
                aria-label="ลบรูป"
              >
                ×
              </button>
            </div>
          ))}
          {pics.length < MAX && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="h-24 w-24 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 text-3xl hover:border-brand hover:text-brand"
            >
              ＋
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2.5">{error}</p>
      )}

      <button
        type="button"
        className="btn-primary"
        onClick={submit}
        disabled={pending || !ready}
      >
        {pending ? "กำลังบันทึก…" : "เพิ่มจุดเช็คอิน"}
      </button>
    </div>
  );
}
