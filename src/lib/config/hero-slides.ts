/**
 * Homepage hero slider configuration.
 *
 * Each entry defines one banner slide.
 * To swap images: update `imagePath` to the public path of the new image.
 * Images should be placed in /public/images/hero/.
 * `backgroundGradient` is displayed as a fallback when the image is absent.
 */

export interface HeroSlide {
  id: string;
  /** Short label shown as a pill badge above the headline (optional). */
  badge?: string;
  /** Main headline — use \n for a manual line break. */
  headline: string;
  /** Supporting text shown below the headline. */
  subtext: string;
  /** CTA button label. */
  ctaLabel: string;
  /** CTA button destination. */
  ctaHref: string;
  /**
   * Path to the slide background image (relative to /public).
   * Example: /images/hero/all-products.jpg
   * The image is loaded as a CSS background-image. If the file does not exist
   * the `backgroundGradient` is shown instead — no broken-image state.
   */
  imagePath: string;
  /**
   * CSS gradient used as the background fallback (and visible underneath a
   * semi-transparent image overlay). Keep this matching the slide theme.
   */
  backgroundGradient: string;
}

export const HERO_SLIDES: HeroSlide[] = [
  {
    id: "all-products",
    badge: "טרי מהשדה",
    headline: "ירקות ופירות טריים\nמהמשק ישירות אליכם",
    subtext: "קטיף יומי · ללא מחסנים · ללא מתווכים · משלוח עד 24 שעות",
    ctaLabel: "לכל המוצרים",
    ctaHref: "/products",
    imagePath: "/images/heroes/home-all-products.png",
    backgroundGradient:
      "linear-gradient(135deg, #1b5e20 0%, #2e7d32 55%, #388e3c 100%)",
  },
  {
    id: "vegetables",
    badge: "ירקות עונתיים",
    headline: "ירקות שדה טריים\nישירות מהקטיף",
    subtext: "מגוון רחב · ירקות שורש · עשבי תיבול · חתוכים ושטופים",
    ctaLabel: "לכל הירקות",
    ctaHref: "/vegetables",
    imagePath: "/images/heroes/home-vegetables.png",
    backgroundGradient:
      "linear-gradient(135deg, #33691e 0%, #558b2f 55%, #689f38 100%)",
  },
  {
    id: "fruits",
    badge: "פירות טריים",
    headline: "פירות מתוקים\nמהפרדס לבית שלכם",
    subtext: "הדר טרי · פירות רגילים · פירות מיוחדים · אורגניים",
    ctaLabel: "לכל הפירות",
    ctaHref: "/fruits",
    imagePath: "/images/heroes/home-fruits.png",
    backgroundGradient:
      "linear-gradient(135deg, #e65100 0%, #f57c00 55%, #fb8c00 100%)",
  },
];
