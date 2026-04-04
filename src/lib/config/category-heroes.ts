/**
 * Hero configuration for parent category landing pages.
 *
 * To replace hero images, update imageSrc here — one place, zero layout changes.
 * Place image files in /public/images/heroes/ and point imageSrc to them.
 *
 * Example replacement:
 *   imageSrc: "/images/heroes/vegetables.jpg"
 */

export interface CategoryHeroConfig {
  title: string;
  subtitle: string;
  imageSrc: string;
  imageAlt: string;
  /** Tailwind bg class used as fallback when image is absent */
  fallbackBg: string;
  /** CSS overlay color (rgba) layered over the image */
  overlayColor: string;
  /** Tailwind class for subcategory tab active state */
  accentClass: string;
  /** Tailwind class for hero text color */
  headingColor: string;
}

export const CATEGORY_HEROES: Record<string, CategoryHeroConfig> = {
  vegetables: {
    title: "ירקות טריים",
    subtitle:
      "ירקות איכותיים שנקטפו אתמול, מסופקים ישירות מהמשק לביתכם. בחירה יומית טרייה.",
    imageSrc: "/images/heroes/vegetables.jpg",
    imageAlt: "ירקות טריים ומגוונים",
    fallbackBg: "bg-green-50",
    overlayColor: "rgba(20, 83, 45, 0.45)",
    accentClass: "bg-green-600",
    headingColor: "text-white",
  },
  fruits: {
    title: "פירות טריים",
    subtitle:
      "פירות עונתיים מובחרים, מתוקים ובשלים לשלמות. ישירות מהפרדסים לשולחנכם.",
    imageSrc: "/images/heroes/fruits.jpg",
    imageAlt: "פירות טריים ומגוונים",
    fallbackBg: "bg-rose-50",
    overlayColor: "rgba(159, 18, 57, 0.40)",
    accentClass: "bg-rose-600",
    headingColor: "text-white",
  },
};

export function getCategoryHero(slug: string): CategoryHeroConfig {
  return (
    CATEGORY_HEROES[slug] ?? {
      title: slug,
      subtitle: "",
      imageSrc: "",
      imageAlt: slug,
      fallbackBg: "bg-stone-50",
      overlayColor: "rgba(0,0,0,0.3)",
      accentClass: "bg-brand-600",
      headingColor: "text-white",
    }
  );
}
