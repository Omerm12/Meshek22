/**
 * Server-side Supabase queries for storefront pages.
 *
 * All functions use createPublicClient() — a cookie-free Supabase client —
 * so that Next.js can ISR-cache routes that call them. The SSR (cookie-aware)
 * client is intentionally NOT used here because catalog data is fully public
 * and does not change per user.
 *
 * Hierarchical category helpers:
 *   fetchTopLevelCategories()             – categories with no parent
 *   fetchChildCategoriesByParentSlug()    – direct children of a parent
 *   fetchCategoryTree()                   – full parent→children tree
 *   fetchProductsByParentCategorySlug()   – products across all child categories
 */

import { createPublicClient } from "@/lib/supabase/public";
import { getCategoryDisplay, getProductDisplay } from "@/lib/product-display";
import type { MockCategory, MockProduct, MockVariant } from "@/lib/data/mock";

// ─── Internal row types ────────────────────────────────────────────────────────

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
};

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
  image_url: string | null;
  is_featured: boolean;
  sort_order: number;
  categories: { id: string; name: string; slug: string } | null;
  product_variants: VariantRow[];
};

// ─── Shared helpers ────────────────────────────────────────────────────────────

function toMockCategory(row: CategoryRow): MockCategory {
  const display = getCategoryDisplay(row.slug);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? "",
    icon: display.icon,
    color: display.color,
    textColor: display.textColor,
    count: 0,
    parentId: row.parent_id,
  };
}

function toMockProduct(row: ProductRow): MockProduct {
  const catSlug = row.categories?.slug ?? "vegetables";
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
    imageUrl: row.image_url ?? null,
  };
}

const PRODUCT_SELECT = `
  id, name, slug, description, image_url, is_featured, sort_order,
  categories ( id, name, slug ),
  product_variants ( id, label, unit, price_agorot, compare_price_agorot, is_default, is_available, sort_order )
`;

// ─── Category queries ──────────────────────────────────────────────────────────

/**
 * All active categories (flat list, includes parent_id).
 * Used for backward-compat storefront category tabs.
 */
export async function fetchCategories(): Promise<MockCategory[]> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, description, parent_id")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error || !data) return [];

  return (data as CategoryRow[]).map(toMockCategory);
}

/**
 * Only top-level categories (parent_id IS NULL).
 */
export async function fetchTopLevelCategories(): Promise<MockCategory[]> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, description, parent_id")
    .eq("is_active", true)
    .is("parent_id", null)
    .order("sort_order", { ascending: true });

  if (error || !data) return [];

  return (data as CategoryRow[]).map(toMockCategory);
}

/**
 * Top-level categories marked as is_featured=true for the homepage.
 * Falls back to ALL top-level categories when none are featured yet,
 * so the homepage never shows an empty "קטגוריות מובילות" section.
 */
export async function fetchFeaturedCategories(): Promise<MockCategory[]> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, description, parent_id")
    .eq("is_active", true)
    .is("parent_id", null)
    .eq("is_featured", true)
    .order("sort_order", { ascending: true });

  if (error) return [];

  // Fallback: if no categories are marked featured yet, show all top-level ones
  if (!data || data.length === 0) {
    return fetchTopLevelCategories();
  }

  return (data as CategoryRow[]).map(toMockCategory);
}

/**
 * Direct child categories of a parent identified by slug.
 */
export async function fetchChildCategoriesByParentSlug(
  parentSlug: string
): Promise<MockCategory[]> {
  const supabase = createPublicClient();

  // 1. Resolve parent slug → id
  const { data: parent, error: parentErr } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", parentSlug)
    .eq("is_active", true)
    .single();

  if (parentErr || !parent) return [];

  // 2. Fetch children
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, description, parent_id")
    .eq("parent_id", parent.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error || !data) return [];

  return (data as CategoryRow[]).map(toMockCategory);
}

/**
 * Full category tree: each top-level category contains a `children` array.
 */
export async function fetchCategoryTree(): Promise<MockCategory[]> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, description, parent_id")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error || !data) return [];

  const all = (data as CategoryRow[]).map(toMockCategory);
  const byId = new Map(all.map((c) => [c.id, c]));

  const roots: MockCategory[] = [];

  for (const cat of all) {
    if (!cat.parentId) {
      cat.children = [];
      roots.push(cat);
    } else {
      const parent = byId.get(cat.parentId);
      if (parent) {
        parent.children = parent.children ?? [];
        parent.children.push(cat);
      }
    }
  }

  return roots;
}

/**
 * All active category slugs — used for generateStaticParams.
 */
export async function fetchAllCategorySlugs(): Promise<string[]> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("categories")
    .select("slug")
    .eq("is_active", true);
  return (data ?? []).map((r) => r.slug);
}

// ─── Product queries ───────────────────────────────────────────────────────────

/**
 * All active products for a given leaf category slug.
 * Uses !inner join so unmatched category rows are excluded.
 */
export async function fetchProductsByCategory(
  categorySlug: string
): Promise<MockProduct[]> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("products")
    .select(`
      id, name, slug, description, is_featured, sort_order,
      categories!inner ( id, name, slug ),
      product_variants ( id, label, unit, price_agorot, compare_price_agorot, is_default, is_available, sort_order )
    `)
    .eq("categories.slug", categorySlug)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error || !data) return [];

  return (data as unknown as ProductRow[]).map(toMockProduct);
}

/**
 * All active products across every child category of a parent.
 * Two round-trips: resolve children IDs, then fetch products.
 */
export async function fetchProductsByParentCategorySlug(
  parentSlug: string
): Promise<MockProduct[]> {
  const supabase = createPublicClient();

  // 1. Resolve parent slug → id
  const { data: parent, error: parentErr } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", parentSlug)
    .eq("is_active", true)
    .single();

  if (parentErr || !parent) return [];

  // 2. Fetch child category IDs
  const { data: children, error: childErr } = await supabase
    .from("categories")
    .select("id")
    .eq("parent_id", parent.id)
    .eq("is_active", true);

  if (childErr || !children || children.length === 0) return [];

  const childIds = children.map((c) => c.id);

  // 3. Fetch products in those child categories
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .in("category_id", childIds)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error || !data) return [];

  return (data as unknown as ProductRow[]).map(toMockProduct);
}

/**
 * Fetch a single product by slug.
 */
export async function fetchProductBySlug(
  slug: string
): Promise<MockProduct | null> {
  const supabase = createPublicClient();

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
 * Featured products for homepage BestSellers section.
 */
export async function fetchFeaturedProducts(
  limit = 8
): Promise<MockProduct[]> {
  const supabase = createPublicClient();

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
 * All active products across all categories — for the /products listing page.
 */
export async function fetchAllProducts(): Promise<MockProduct[]> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error || !data) return [];

  return (data as unknown as ProductRow[]).map(toMockProduct);
}

/**
 * All active product slugs — for generateStaticParams.
 */
export async function fetchAllProductSlugs(): Promise<string[]> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("products")
    .select("slug")
    .eq("is_active", true);
  return (data ?? []).map((r) => r.slug);
}
