import Link from "next/link";

// การ์ดตัวเลขใหญ่ (ตัวเลขกลาง + ป้ายใต้) ใช้บนหัวแดชบอร์ดผู้บริหาร/งานซ่อม
export default function KpiTile({
  label,
  value,
  tone = "text-gray-900",
  sub,
  href,
}: {
  label: string;
  value: number | string;
  tone?: string;
  sub?: React.ReactNode;
  href?: string;
}) {
  const inner = (
    <>
      <div className={`text-3xl font-bold ${tone}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
      {sub && <div className="mt-1.5">{sub}</div>}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="card p-4 text-center hover:bg-gray-50 transition">
        {inner}
      </Link>
    );
  }
  return <div className="card p-4 text-center">{inner}</div>;
}
