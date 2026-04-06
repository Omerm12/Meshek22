import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import type { CategoryHeroConfig } from "@/lib/config/category-heroes";

export function CategoryHero({ config }: { config: CategoryHeroConfig }) {
  return (
    <div
      className="relative w-full overflow-hidden h-[220px] sm:h-[270px] lg:h-[320px]"
      style={{ backgroundColor: config.containerBg }}
    >
      {config.imageSrc && (
        <Image
          src={config.imageSrc}
          alt={config.imageAlt}
          fill
          style={{ objectFit: "cover", objectPosition: "center" }}
          priority
          aria-hidden="true"
        />
      )}

      <div className="absolute inset-0" style={{ backgroundColor: config.overlayColor }} aria-hidden="true" />

      <div
        className="absolute inset-x-0 bottom-0 h-20 pointer-events-none"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.25) 0%, transparent 100%)" }}
        aria-hidden="true"
      />

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
        <h1
          className={cn("font-bold tracking-tight", config.headingColor)}
          style={{
            fontSize: "clamp(2.4rem, 5vw, 4rem)",
            lineHeight: 1.1,
            textShadow: "0 2px 20px rgba(0,0,0,0.6), 0 1px 4px rgba(0,0,0,0.4)",
          }}
        >
          {config.title}
        </h1>

        {config.subtitle && (
          <p
            className="text-white/90 leading-relaxed mt-4 max-w-sm"
            style={{
              fontSize: "clamp(0.95rem, 2vw, 1.1rem)",
              textShadow: "0 1px 10px rgba(0,0,0,0.55)",
              letterSpacing: "0.01em",
            }}
          >
            {config.subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
