import { cn } from "@/lib/utils/cn";
import type { MockCategory } from "@/lib/data/mock";

interface CategoryCardProps {
  category: MockCategory;
  className?: string;
}

export function CategoryCard({ category, className }: CategoryCardProps) {
  return (
    <a
      href={`/category/${category.slug}`}
      className={cn(
        "group flex flex-col items-center gap-2.5 p-4 rounded-2xl",
        "bg-white border border-stone-100",
        "hover:border-brand-200 hover:shadow-md hover:-translate-y-0.5",
        "transition-all duration-300 cursor-pointer text-center",
        className
      )}
    >
      {/* Icon circle */}
      <div
        className={cn(
          "h-14 w-14 rounded-2xl flex items-center justify-center text-[28px]",
          "transition-transform duration-300 group-hover:scale-110",
          category.color
        )}
        aria-hidden="true"
      >
        {category.icon}
      </div>

      {/* Text */}
      <div>
        <p className="font-semibold text-[13px] text-gray-900 group-hover:text-brand-700 transition-colors leading-tight">
          {category.name}
        </p>
        <p className="text-[11px] text-stone-400 mt-0.5">{category.count} מוצרים</p>
      </div>
    </a>
  );
}
