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
];

/** "All products" top-level link — rendered before the category dropdowns. */
export const ALL_PRODUCTS_LINK: NavLink = { label: "כל המוצרים", href: "/products" };

export const SIMPLE_NAV_LINKS: NavLink[] = [
  { label: "מבצעים",      href: "/promotions" },
  { label: "אזורי משלוח", href: "/delivery-areas" },
  { label: "אודות",       href: "/about" },
];
