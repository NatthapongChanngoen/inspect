import type { LucideIcon } from "lucide-react";
import Link from "next/link";

type Accent = "blue" | "amber" | "emerald" | "rose" | "gray" | "orange";

const accents: Record<
  Accent,
  { icon: string; bg: string; value: string; borderL: string }
> = {
  blue: {
    icon: "text-blue-600",
    bg: "bg-blue-50",
    value: "text-gray-800",
    borderL: "border-l-blue-500",
  },
  amber: {
    icon: "text-amber-600",
    bg: "bg-amber-50",
    value: "text-gray-800",
    borderL: "border-l-amber-500",
  },
  emerald: {
    icon: "text-emerald-600",
    bg: "bg-emerald-50",
    value: "text-gray-800",
    borderL: "border-l-emerald-500",
  },
  rose: {
    icon: "text-rose-600",
    bg: "bg-rose-50",
    value: "text-gray-800",
    borderL: "border-l-rose-500",
  },
  gray: {
    icon: "text-gray-500",
    bg: "bg-gray-100",
    value: "text-gray-800",
    borderL: "border-l-gray-300",
  },
  orange: {
    icon: "text-orange-600",
    bg: "bg-orange-50",
    value: "text-gray-800",
    borderL: "border-l-orange-500",
  },
};

export default function StatCard({
  label,
  value,
  icon: Icon,
  accent = "gray",
  href,
  active = false,
  sub,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  accent?: Accent;
  href?: string;
  active?: boolean;
  sub?: React.ReactNode;
}) {
  const a = accents[accent];
  const cls = `block bg-white rounded-xl border border-gray-100 border-l-4 ${
    a.borderL
  } p-4 shadow-sm transition-all duration-200 ${
    active ? "ring-2 ring-brand/50" : ""
  } ${href ? "hover:shadow-md hover:-translate-y-0.5" : "hover:shadow-md"}`;

  const inner = (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className={`text-3xl font-bold leading-tight ${a.value}`}>
          {value}
        </div>
        <div className="text-sm text-gray-500 truncate mt-0.5">{label}</div>
        {sub != null && <div className="mt-1">{sub}</div>}
      </div>
      <div
        className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${a.bg} ${a.icon}`}
      >
        <Icon size={18} strokeWidth={2} />
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} scroll={false} className={cls}>
        {inner}
      </Link>
    );
  }
  return <div className={cls}>{inner}</div>;
}
