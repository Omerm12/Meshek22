import { cn } from "@/lib/utils/cn";

type BadgeVariant = "brand" | "sale" | "new" | "neutral" | "warning";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  brand:   "bg-brand-100 text-brand-700",
  sale:    "bg-red-100 text-red-700",
  new:     "bg-amber-100 text-amber-700",
  neutral: "bg-stone-100 text-stone-600",
  warning: "bg-orange-100 text-orange-700",
};

export function Badge({ variant = "brand", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
