/**
 * Hero configuration for parent category landing pages.
 *
 * To replace hero images, update imageSrc here — one place, zero layout changes.
 * Place image files in /public/images/heroes/ and point imageSrc to them.
 *
 * A category with no artwork can instead supply backgroundGradient (and
 * optionally decorativeGradient) and be rendered entirely in CSS.
 */

import { ICE_CREAMS_AND_NUTS_SLUG } from "@/lib/config/nav-categories";

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
  /**
   * CSS object-fit for the banner image. Defaults to "cover".
   * Use "contain" for images that should be shown without any cropping.
   */
  imageObjectFit?: "cover" | "contain";
  /**
   * CSS object-position for the banner image. Defaults to "center".
   * Allows focal-point adjustment per image.
   */
  imageObjectPosition?: string;
  /**
   * CSS background-image for categories that have no photograph.
   * Painted over containerBg, so the solid colour remains the fallback.
   */
  backgroundGradient?: string;
  /**
   * Optional second layer of soft decorative glows, drawn above the background
   * and below the text. Presentational only.
   */
  decorativeGradient?: string;
}

export const CATEGORY_HEROES: Record<string, CategoryHeroConfig> = {
  search: {
    title: "תוצאות חיפוש",
    subtitle: "ירקות ופירות טריים · קטיף יומי · ישירות מהשדה",
    imageSrc: "/images/heroes/home-all-products.png",
    imageAlt: "מוצרים טריים של משק 22",
    fallbackBg: "bg-stone-900",
    containerBg: "#111810",
    overlayColor: "rgba(10, 20, 8, 0.32)",
    accentClass: "bg-brand-600",
    headingColor: "text-white",
  },
  vegetables: {
    title: "ירקות טריים",
    subtitle: "קטיפים יומיים · ישירות מהשדה לביתכם",
    imageSrc: "/images/heroes/home-vegetables.jpeg",
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
    imageSrc: "/images/heroes/home-fruits.jpeg",
    imageAlt: "פירות טריים ומגוונים ממשק 22",
    fallbackBg: "bg-rose-950",
    containerBg: "#2a0810",
    overlayColor: "rgba(60, 10, 20, 0.28)",
    accentClass: "bg-rose-600",
    headingColor: "text-white",
  },
  // Combined ice-cream + nut category.
  //
  // The photograph is a 2172×724 panorama (≈3:1): ice creams on one side, bowls
  // of nuts on the other, and a deliberately empty mottled centre that the
  // heading and subtitle sit in. Everything below is chosen to keep that centre
  // band on screen at every width.
  //
  // Cropping — object-fit: cover with the default centred focal point:
  //   • Mobile (375×250, ≈1.5:1)  the image is far wider than the box, so cover
  //     scales to the height and shows the middle ~50% of the width: the empty
  //     centre, flanked by a hint of ice cream and of nuts.
  //   • Tablet (768×310, ≈2.5:1)  shows roughly the middle 83% — nearly the
  //     whole scene.
  //   • Desktop (1440×370, ≈3.9:1) the box is now wider than the image, so cover
  //     scales to the width and trims ~11% off the top and bottom — empty
  //     backdrop above and the front edge of the table below. Every product
  //     stays in frame.
  // Centred works at all three, so no per-breakpoint focal point is needed.
  //
  // Contrast — the centre of the photo is a light cream (luminance ≈0.63), which
  // white text alone could not sit on (≈1.5:1). decorativeGradient is therefore a
  // scrim rather than decoration: an ellipse centred on the text, ≈0.66 alpha at
  // the middle and fully transparent by 78%, so the text area reaches ≈8:1 while
  // the ice creams and nuts at the edges keep their colour. Sized in percentages,
  // so it tracks the banner at every breakpoint. overlayColor adds a light,
  // even wash for cohesion.
  //
  // backgroundGradient is retained underneath as the paint shown if the image
  // ever fails to load — it is invisible while the photo is present.
  [ICE_CREAMS_AND_NUTS_SLUG]: {
    title: "גלידות ופיצוחים",
    subtitle: "משהו מתוק, משהו מלוח — כל הפינוקים במקום אחד.",
    imageSrc: "/images/heroes/8e8052e1-1d80-4837-bd6d-ac93c4394d8a.png",
    imageAlt: "גלידות, ארטיקים וקערות פיצוחים על שולחן עץ במשק 22",
    imageObjectFit: "cover",
    imageObjectPosition: "center",
    fallbackBg: "bg-slate-900",
    containerBg: "#12283b",
    backgroundGradient:
      "linear-gradient(118deg, #0d2a42 0%, #14455c 34%, #3c4034 62%, #6d3f1a 100%)",
    decorativeGradient:
      "radial-gradient(ellipse 62% 78% at 50% 46%, " +
      "rgba(10, 26, 16, 0.66) 0%, rgba(10, 26, 16, 0.42) 45%, rgba(10, 26, 16, 0) 78%)",
    overlayColor: "rgba(10, 26, 16, 0.18)",
    accentClass: "bg-brand-600",
    headingColor: "text-white",
  },
  sale: {
    title: "מבצעים",
    subtitle: "כל המוצרים שנמצאים כרגע במבצע",
    imageSrc: "/images/heroes/sale.png",
    imageAlt: "מבצעים ממשק 22",
    fallbackBg: "bg-red-950",
    containerBg: "#1a0a04",
    overlayColor: "rgba(40, 10, 5, 0.30)",
    accentClass: "bg-red-600",
    headingColor: "text-white",
    imageObjectFit: "cover",
    imageObjectPosition: "center 40%",
  },
  delivery: {
    title: "אזורי משלוח",
    subtitle: "משלוח ישירות מהמשק לביתכם – ברחבי ישראל",
    imageSrc: "/images/heroes/delivery.png",
    imageAlt: "משלוחים של משק 22",
    fallbackBg: "bg-sky-950",
    containerBg: "#041524",
    overlayColor: "rgba(4, 20, 40, 0.32)",
    accentClass: "bg-sky-600",
    headingColor: "text-white",
    imageObjectFit: "cover",
    imageObjectPosition: "40% center",
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
