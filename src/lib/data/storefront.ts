/**
 * Server-side Supabase queries for storefront pages.
 * All functions return types that are compatible with the existing UI components.
 */

import { createClient } from "@/lib/supabase/server";
import { getCategoryDisplay, getProductDisplay } from "@/lib/product-display";
import type { MockCategory, MockProduct, MockVariant } from "@/lib/data/mock";

// ─── Categories ───────────────────────────────────────────────────────────────

/**
 * Fetch all active categories ordered by sort_order.
 * Returns MockCategory-compatible objects so CategoryShell works unchanged.
 */
export async function fetchCategories(): Promise<MockCategory[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, description")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error || !data) return [];

  return data.map((cat) => {
    const display = getCategoryDisplay(cat.slug);
    return {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description ?? "",
      icon: display.icon,
      color: display.color,
      textColor: display.textColor,
      count: 0, // populated separately when needed
    };
  });
}

// ─── Products ─────────────────────────────────────────────────────────────────

type VariantRow = {
  id: string;
  label: string;
  unit: string;
  price_agorot: number;
  compare_price_agorot: number | null;
  is_default: boolean;
  is_available: boolean;
  sort_order: number;
};

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_featured: boolean;
  sort_order: number;
  categories: { id: string; name: string; slug: string } | null;
  product_variants: VariantRow[];
};

function toMockProduct(row: ProductRow): MockProduct {
  const catSlug = row.categories?.slug ?? "yerakot";
  const display = getProductDisplay(row.slug);

  const variants: MockVariant[] = row.product_variants
    .filter((v) => v.is_available)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((v) => ({
      id: v.id,
      label: v.label,
      unit: v.unit,
      priceAgorot: v.price_agorot,
      comparePriceAgorot: v.compare_price_agorot,
      isDefault: v.is_default,
    }));

  // Ensure at least one variant is marked default
  if (variants.length > 0 && !variants.some((v) => v.isDefault)) {
    variants[0] = { ...variants[0], isDefault: true };
  }

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? "",
    categorySlug: catSlug,
    categoryName: row.categories?.name ?? "",
    isFeatured: row.is_featured,
    variants,
    imageColor: display.imageColor,
    icon: display.icon,
  };
}

const PRODUCT_SELECT = `
  id, name, slug, description, is_featured, sort_order,
  categories ( id, name, slug ),
  product_variants ( id, label, unit, price_agorot, compare_price_agorot, is_default, is_available, sort_order )
`;

/**
 * Fetch all active products for a given category slug.
 */
export async function fetchProductsByCategory(categorySlug: string): Promise<MockProduct[]> {
  const supabase = await createClient();

  // First resolve category id
  const { data: cat } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", categorySlug)
    .eq("is_active", true)
    .single();

  if (!cat) return [];

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("category_id", cat.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error || !data) return [];

  return (data as unknown as ProductRow[]).map(toMockProduct);
}

/**
 * Fetch a single product by slug.
 */
export async function fetchProductBySlug(slug: string): Promise<MockProduct | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error || !data) return null;

  return toMockProduct(data as unknown as ProductRow);
}

/**
 * Fetch featured products (for homepage BestSellers).
 */
export async function fetchFeaturedProducts(limit = 8): Promise<MockProduct[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_active", true)
    .eq("is_featured", true)
    .order("sort_order", { ascending: true })
    .limit(limit);

  if (error || !data) return [];

  return (data as unknown as ProductRow[]).map(toMockProduct);
}

/**
 * Fetch all active product slugs (for generateStaticParams).
 */
export async function fetchAllProductSlugs(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("slug")
    .eq("is_active", true);
  return (data ?? []).map((r) => r.slug);
}

/**
 * Fetch all active category slugs (for generateStaticParams).
 */
export async function fetchAllCategorySlugs(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("slug")
    .eq("is_active", true);
  return (data ?? []).map((r) => r.slug);
}
