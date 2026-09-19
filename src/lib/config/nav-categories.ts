/**
 * Navigation structure for the storefront header.
 *
 * The header's category tree (parents + children) is now fetched from
 * Supabase at request time — see fetchNavbarCategoryTree() in
 * src/lib/data/storefront.ts, driven by each category's `is_active` and
 * `show_in_navbar` columns. Adding, hiding, or reordering a category in the
 * navbar is an admin action, not a code change.
 *
 * PARENT_CATEGORY_NAV below is NOT read by the header any more. It remains
 * as the href-resolution table for src/components/shop/CategoryCard.tsx
 * (homepage category cards, which only ever render the three fixed
 * top-level cards from fetchHomepageCategories()) and as reference data
 * for hero/redirect config elsewhere in this file. Slugs must match actual
 * DB slugs.
 */

export interface NavChild {
  label: string;
  slug: string;
  href: string;
  icon: string;
}

export interface NavParentCategory {
  label: string;
  slug: string;
  href: string;
  icon: string;
  children: NavChild[];
}

export interface NavLink {
  label: string;
  href: string;
}

/**
 * The broader "עוד מהמשק" parent category (formerly the combined ice-cream +
 * nut category, גלידות ופיצוחים).
 *
 * Declared as constants because the slug and path are referenced by the nav, the
 * page, the hero config, the revalidation list and the legacy redirects — one
 * definition keeps them from drifting apart.
 */
export const MORE_FROM_THE_FARM_SLUG = "more-from-the-farm";
export const MORE_FROM_THE_FARM_HREF = `/${MORE_FROM_THE_FARM_SLUG}`;

/**
 * Storefront routes that were merged into the "עוד מהמשק" category page.
 *
 * Each key is a retired top-level path; the value is where it now permanently
 * redirects (308). Old bookmarks, printed material and search results keep
 * working. /ice-creams and /nuts land directly on their matching child
 * subcategory tab (the same `?sub=` pattern the fruits/vegetables pages use),
 * since both still exist as real, selectable child categories.
 */
export const MERGED_CATEGORY_REDIRECTS: Record<string, string> = {
  "/ice-creams-and-nuts": MORE_FROM_THE_FARM_HREF,
  "/ice-creams":          `${MORE_FROM_THE_FARM_HREF}?sub=ice-creams`,
  "/nuts":                `${MORE_FROM_THE_FARM_HREF}?sub=nuts`,
};

export const PARENT_CATEGORY_NAV: NavParentCategory[] = [
  {
    label: "ירקות",
    slug: "vegetables",
    href: "/vegetables",
    icon: "🥬",
    children: [
      { label: "ירקות רגילים",          slug: "regular-vegetables",    href: "/vegetables?sub=regular-vegetables",    icon: "🥦" },
      { label: "ירקות שורש",            slug: "root-vegetables",       href: "/vegetables?sub=root-vegetables",       icon: "🥕" },
      { label: "ירקות עלים",            slug: "leafy-vegetables",      href: "/vegetables?sub=leafy-vegetables",      icon: "🥬" },
      { label: "עשבי תיבול",            slug: "herbs",                 href: "/vegetables?sub=herbs",                 icon: "🌿" },
      { label: "ירקות מיוחדים",         slug: "special-vegetables",    href: "/vegetables?sub=special-vegetables",    icon: "🫑" },
      { label: "ירקות חתוכים ושטופים", slug: "cut-washed-vegetables", href: "/vegetables?sub=cut-washed-vegetables", icon: "🔪" },
      { label: "מגשי ירקות",           slug: "vegetable-trays",       href: "/vegetables?sub=vegetable-trays",       icon: "🥗" },
    ],
  },
  {
    label: "פירות",
    slug: "fruits",
    href: "/fruits",
    icon: "🍎",
    children: [
      { label: "פירות הדר",      slug: "citrus-fruits",  href: "/fruits?sub=citrus-fruits",  icon: "🍊" },
      { label: "פירות רגילים",   slug: "regular-fruits", href: "/fruits?sub=regular-fruits", icon: "🍎" },
      { label: "פירות מיוחדים",  slug: "special-fruits", href: "/fruits?sub=special-fruits", icon: "🍇" },
      { label: "פירות יבשים",   slug: "dried-fruits",   href: "/fruits?sub=dried-fruits",   icon: "🍑" },
      { label: "פירות אורגניים", slug: "organic-fruits", href: "/fruits?sub=organic-fruits", icon: "🌱" },
    ],
  },
  // A broader catch-all category, built with the same parent/child pattern as
  // ירקות and פירות above: real child categories the customer can select, and
  // a page that behaves exactly like the fruits/vegetables pages.
  {
    label: "עוד מהמשק",
    slug: MORE_FROM_THE_FARM_SLUG,
    href: MORE_FROM_THE_FARM_HREF,
    icon: "🧺",
    children: [
      { label: "תבלינים",         slug: "spices",              href: `${MORE_FROM_THE_FARM_HREF}?sub=spices`,              icon: "🌶️" },
      { label: "ביצים",           slug: "eggs",                href: `${MORE_FROM_THE_FARM_HREF}?sub=eggs`,                icon: "🥚" },
      { label: "פיצוחים",         slug: "nuts",                href: `${MORE_FROM_THE_FARM_HREF}?sub=nuts`,                icon: "🥜" },
      { label: "שמן זית",         slug: "olive-oil",           href: `${MORE_FROM_THE_FARM_HREF}?sub=olive-oil`,           icon: "🫒" },
      { label: "ירקות קרנצ'ים",  slug: "crunchy-vegetables",  href: `${MORE_FROM_THE_FARM_HREF}?sub=crunchy-vegetables`,  icon: "🥕" },
      { label: "סכינים ומקלפים",  slug: "knives-and-peelers", href: `${MORE_FROM_THE_FARM_HREF}?sub=knives-and-peelers`,  icon: "🔪" },
      { label: "גלידות",          slug: "ice-creams",          href: `${MORE_FROM_THE_FARM_HREF}?sub=ice-creams`,          icon: "🍦" },
    ],
  },
];

export const SIMPLE_NAV_LINKS: NavLink[] = [
  { label: "מבצעים",      href: "/promotions" },
  { label: "אזורי משלוח", href: "/delivery-areas" },
  { label: "אודות",       href: "/about" },
];

/**
 * Where a top-level category's landing page lives.
 *
 * ירקות, פירות and עוד מהמשק predate the dynamic navbar and keep their
 * existing, SEO-indexed routes so no current URL ever changes. Any other
 * active top-level category — created entirely through the admin, with no
 * code change — falls back to the generic /category/[slug] page: the same
 * ParentCategoryShell and fetchParentCategoryPageData() every dedicated page
 * already uses, just resolved by slug at request time instead of hardcoded
 * per route.
 */
export const DEDICATED_PARENT_ROUTES: Record<string, string> = {
  vegetables: "/vegetables",
  fruits: "/fruits",
  [MORE_FROM_THE_FARM_SLUG]: MORE_FROM_THE_FARM_HREF,
};

export function resolveParentCategoryHref(slug: string): string {
  return DEDICATED_PARENT_ROUTES[slug] ?? `/category/${slug}`;
}
