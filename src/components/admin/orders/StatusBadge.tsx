import type { StatusEntry } from "@/lib/utils/order-status";

interface StatusBadgeProps {
  map:   Record<string, StatusEntry>;
  value: string;
}

export function StatusBadge({ map, value }: StatusBadgeProps) {
  const s = map[value] ?? { label: value, cls: "bg-gray-100 text-gray-500 border-gray-200" };
  return (
    <span
      className={`inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold border ${s.cls}`}
    >
      {s.label}
    </span>
  );
}
