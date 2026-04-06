/**
 * Hero configuration for parent category landing pages.
 *
 * To replace hero images, update imageSrc here — one place, zero layout changes.
 * Place image files in /public/images/heroes/ and point imageSrc to them.
 */

export interface CategoryHeroConfig {
  title: string;
  subtitle: string;
  imageSrc: string;
  imageAlt: string;
  /** Tailwind bg class used as fallback when image is absent */
  fallbackBg: string;
  /**
   * Dark solid colour used as the container background.
   * With object-contain this fills any letterbox areas and looks intentional.
   */
  containerBg: string;
  /** Semi-transparent overlay layered on top of the image for text legibility */
  overlayColor: string;
  /** Tailwind class for subcategory tab active state */
  accentClass: string;
  /** Tailwind class for hero heading color */
  headingColor: string;
}

export const CATEGORY_HEROES: Record<string, CategoryHeroConfig> = {
  products: {
    title: "כל המוצרים",
    subtitle: "ירקות ופירות טריים · קטיף יומי · ישירות מהשדה",
    imageSrc: "/images/heroes/home-all-products.png",
    imageAlt: "כל המוצרים של משק 22",
    fallbackBg: "bg-stone-900",
    containerBg: "#111810",
    overlayColor: "rgba(10, 20, 8, 0.32)",
    accentClass: "bg-brand-600",
    headingColor: "text-white",
  },
  vegetables: {
    title: "ירקות טריים",
    subtitle: "קטיפים יומיים · ישירות מהשדה לביתכם",
    imageSrc: "/images/heroes/home-vegetables.png",
    imageAlt: "ירקות טריים ומגוונים ממשק 22",
    fallbackBg: "bg-green-950",
    containerBg: "#0b2412",
    overlayColor: "rgba(10, 40, 18, 0.30)",
    accentClass: "bg-green-600",
    headingColor: "text-white",
  },
  fruits: {
    title: "פירות טריים",
    subtitle: "עונתיים · מתוקים · ישירות מהפרדס לשולחנכם",
    imageSrc: "/images/heroes/home-fruits.png",
    imageAlt: "פירות טריים ומגוונים ממשק 22",
    fallbackBg: "bg-rose-950",
    containerBg: "#2a0810",
    overlayColor: "rgba(60, 10, 20, 0.28)",
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
      containerBg: "#1a1a1a",
      overlayColor: "rgba(0,0,0,0.3)",
      accentClass: "bg-brand-600",
      headingColor: "text-white",
    }
  );
}
