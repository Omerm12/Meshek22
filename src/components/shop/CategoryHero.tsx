import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import type { CategoryHeroConfig } from "@/lib/config/category-heroes";

/**
 * Toggle: set to `false` to revert to the original (smaller) banner height.
 * Set to `true` for the slightly taller version that reveals more of the image.
 */
const isExpandedImage = true;

export function CategoryHero({ config }: { config: CategoryHeroConfig }) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden",
        isExpandedImage
          ? "h-[250px] sm:h-[310px] lg:h-[370px]" // expanded — ~13% taller, more image visible
          : "h-[220px] sm:h-[270px] lg:h-[320px]", // original
      )}
      style={{ backgroundColor: config.containerBg }}
    >
      {config.imageSrc && (
        <Image
          src={config.imageSrc}
          alt={config.imageAlt}
          fill
          sizes="100vw"
          style={{
            objectFit: config.imageObjectFit ?? "cover",
            objectPosition: config.imageObjectPosition ?? "center",
          }}
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
