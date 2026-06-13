import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

export default function EmptyState({
  text,
  icon: Icon = Inbox,
}: {
  text: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-12 px-4">
      <Icon size={44} strokeWidth={1.5} className="text-gray-300 mb-3" />
      <p className="text-gray-400 text-sm">{text}</p>
    </div>
  );
}
