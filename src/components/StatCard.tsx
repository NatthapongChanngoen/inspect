import type { LucideIcon } from "lucide-react";

type Accent = "blue" | "amber" | "emerald" | "rose" | "gray";

const accents: Record<
  Accent,
  { icon: string; bg: string; value: string; border: string }
> = {
  blue: {
    icon: "text-blue-600",
    bg: "bg-blue-50",
    value: "text-gray-800",
    border: "border-blue-300",
  },
  amber: {
    icon: "text-amber-600",
    bg: "bg-amber-50",
    value: "text-gray-800",
    border: "border-amber-300",
  },
  emerald: {
    icon: "text-emerald-600",
    bg: "bg-emerald-50",
    value: "text-emerald-600",
    border: "border-emerald-300",
  },
  rose: {
    icon: "text-rose-600",
    bg: "bg-rose-50",
    value: "text-rose-600",
    border: "border-rose-300",
  },
  gray: {
    icon: "text-gray-500",
    bg: "bg-gray-100",
    value: "text-gray-800",
    border: "border-gray-200",
  },
};

export default function StatCard({
  label,
  value,
  icon: Icon,
  accent = "gray",
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  accent?: Accent;
}) {
  const a = accents[accent];
  return (
    <div
      className={`bg-white rounded-xl border-2 ${a.border} p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-all duration-200`}
    >
      <div
        className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${a.bg} ${a.icon}`}
      >
        <Icon size={24} strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <div className={`text-3xl font-bold leading-tight ${a.value}`}>
          {value}
        </div>
        <div className="text-sm text-gray-500 truncate">{label}</div>
      </div>
    </div>
  );
}
