import { cn } from "@/lib/utils/cn";

interface SectionTitleProps {
  title: string;
  subtitle?: string;
  centered?: boolean;
  className?: string;
  tag?: "h1" | "h2" | "h3";
  id?: string;
}

export function SectionTitle({
  title,
  subtitle,
  centered = false,
  className,
  tag: Tag = "h2",
  id,
}: SectionTitleProps) {
  return (
    <div className={cn(centered && "text-center", className)}>
      <Tag id={id} className="text-2xl font-bold text-gray-900 sm:text-3xl leading-tight">
        {title}
      </Tag>
      {subtitle && (
        <p className="mt-2 text-base text-stone-500 leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
}
