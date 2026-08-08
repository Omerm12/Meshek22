/**
 * Navigation structure for the storefront header.
 *
 * Top-level categories with optional child menus are defined here.
 * This decouples the header from DB round-trips on every render.
 * Update this file when adding new top-level categories to navigation.
 *
 * Slugs must match actual DB slugs.
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
 * The combined ice-cream + nut category.
 *
 * Declared as constants because the slug and path are referenced by the nav, the
 * page, the hero config, the revalidation list and the legacy redirects — one
 * definition keeps them from drifting apart.
 */
export const ICE_CREAMS_AND_NUTS_SLUG = "ice-creams-and-nuts";
export const ICE_CREAMS_AND_NUTS_HREF = `/${ICE_CREAMS_AND_NUTS_SLUG}`;

/**
 * Storefront routes that were merged into a combined category page.
 *
 * Each key is a retired top-level path; the value is where it now permanently
 * redirects (308). Old bookmarks, printed material and search results keep
 * working, and the child slugs stay valid for admin product assignment.
 */
export const MERGED_CATEGORY_REDIRECTS: Record<string, string> = {
  "/ice-creams": ICE_CREAMS_AND_NUTS_HREF,
  "/nuts":       ICE_CREAMS_AND_NUTS_HREF,
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
  // גלידות and פיצוחים are one customer-facing category. They still exist as
  // child categories in the database so the shop owner can file a product as
  // one or the other, but neither gets its own page or its own nav entry —
  // `children` is empty here so the header renders a single link with no
  // dropdown. Customers narrow the combined page down with the on-page filter
  // tabs, which the shell builds from the database.
  {
    label: "גלידות ופיצוחים",
    slug: ICE_CREAMS_AND_NUTS_SLUG,
    href: ICE_CREAMS_AND_NUTS_HREF,
    icon: "🍦",
    children: [],
  },
];

export const SIMPLE_NAV_LINKS: NavLink[] = [
  { label: "מבצעים",      href: "/promotions" },
  { label: "אזורי משלוח", href: "/delivery-areas" },
  { label: "אודות",       href: "/about" },
];
