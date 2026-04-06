/**
 * Shared types for storefront data.
 *
 * The actual data is fetched from Supabase — see src/lib/data/storefront.ts.
 * These interfaces are kept here so component files don't need to import
 * directly from Supabase-generated types.
 */

export interface MockCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;       // emoji
  color: string;      // Tailwind bg class
  textColor: string;
  count: number;
  parentId: string | null;
  children?: MockCategory[];
}

export interface MockVariant {
  id: string;
  label: string;
  unit: string;
  priceAgorot: number;
  comparePriceAgorot: number | null;
  isDefault: boolean;
}

export interface MockProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  longDescription?: string;
  categorySlug: string;
  categoryName: string;
  isFeatured: boolean;
  variants: MockVariant[];
  imageColor: string;  // css color for gradient background
  icon: string;        // emoji fallback
  /** Supabase Storage public URL. Null/undefined → show emoji fallback. */
  imageUrl: string | null;
}
