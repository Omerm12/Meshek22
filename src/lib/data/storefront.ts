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
 *   fetchProductsByParentCategorySlug()   – products assigned to the parent
 *                                           itself AND to any child category
 *   fetchPromotionalProducts()            – the dynamic /promotions collection
 */

import { createPublicClient } from "@/lib/supabase/public";
import { getCategoryDisplay, getProductDisplay } from "@/lib/product-display";
import {
  collectPromotionalVariantIds,
  fetchLivePromotions,
  isPromotionalProduct,
} from "@/lib/data/promotions";
import { buildVariantPromotionMap } from "@/lib/promotions/engine";
import type { Promotion } from "@/lib/promotions/types";
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
  quantity_pricing_mode: 'per_kg' | 'fixed';
  quantity_step: number;
  min_quantity: number;
};

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  is_featured: boolean;
  sort_order: number;
  created_at: string;
  qty_deal_enabled: boolean;
  qty_deal_quantity: number | null;
  qty_deal_price_agorot: number | null;
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
      quantityPricingMode: v.quantity_pricing_mode,
      quantityStep: v.quantity_step,
      minQuantity: v.min_quantity,
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
    dealEnabled:      row.qty_deal_enabled      ?? false,
    dealQuantity:     row.qty_deal_quantity      ?? null,
    dealPriceAgorot:  row.qty_deal_price_agorot  ?? null,
  };
}

/**
 * Every product column the storefront renders, minus the category join.
 *
 * Shared so the two select variants below cannot drift apart. They did: the
 * category-filtered query omitted the qty_deal_* columns, which silently
 * dropped legacy quantity deals whenever a customer selected a subcategory tab
 * (and on the whole גלידות ופיצוחים page, which filters by category).
 */
const PRODUCT_COLUMNS = `
  id, name, slug, description, image_url, is_featured, sort_order, created_at,
  qty_deal_enabled, qty_deal_quantity, qty_deal_price_agorot,
  product_variants ( id, label, unit, price_agorot, compare_price_agorot, is_default, is_available, sort_order, quantity_pricing_mode, quantity_step, min_quantity )
`;

const PRODUCT_SELECT = `
  ${PRODUCT_COLUMNS},
  categories ( id, name, slug )
`;

/** Same columns, but with an inner join so a category-slug filter can be applied. */
const PRODUCT_SELECT_BY_CATEGORY = `
  ${PRODUCT_COLUMNS},
  categories!inner ( id, name, slug )
`;

// ─── Promotion decoration ──────────────────────────────────────────────────────

/**
 * Attach the live group promotion (if any) to each variant.
 *
 * One extra query per page render, shared by every product on that page.
 * Callers pass a promise that was started BEFORE the product query so the two
 * round-trips overlap instead of running back to back — decorating products is
 * otherwise a pure post-processing step that would needlessly serialise them.
 */
async function withPromotions(
  products: MockProduct[],
  promotions?: Promotion[] | Promise<Promotion[]>
): Promise<MockProduct[]> {
  if (products.length === 0) return products;

  const live = await (promotions ?? fetchLivePromotions());
  if (live.length === 0) return products;

  const byVariant = buildVariantPromotionMap(live);

  return products.map((product) => ({
    ...product,
    variants: product.variants.map((variant) => {
      const promotion = byVariant.get(variant.id);
      return promotion
        ? {
            ...variant,
            promotion: {
              id: promotion.id,
              name: promotion.name,
              requiredQuantity: promotion.requiredQuantity,
              bundlePriceAgorot: promotion.bundlePriceAgorot,
            },
          }
        : variant;
    }),
  }));
}

// The rule for /promotions membership lives in @/lib/data/promotions as a pure,
// unit-tested function — see isPromotionalProduct().

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

  // Started first so it overlaps the product query.
  const promotionsPromise = fetchLivePromotions();

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT_BY_CATEGORY)
    .eq("categories.slug", categorySlug)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return withPromotions(
    (data as unknown as ProductRow[]).map(toMockProduct).filter((p) => p.variants.length > 0),
    promotionsPromise
  );
}

/**
 * Every category whose products belong on a parent category's page: the parent
 * itself, followed by each of its active children.
 *
 * Returned in a stable order with duplicates removed, so a malformed row (a
 * category listing itself as its own child, say) cannot make the same id appear
 * twice in the query.
 */
export function collectCategoryIds(
  parentId: string,
  children: { id: string }[] | null | undefined
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const id of [parentId, ...(children ?? []).map((c) => c.id)]) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/**
 * Keep the first occurrence of each product id.
 *
 * A product carries exactly one category_id, so the parent-plus-children query
 * cannot currently return the same product twice. This makes the "listed exactly
 * once" guarantee explicit and testable rather than an implicit consequence of
 * the schema, which matters for the combined גלידות ופיצוחים page where three
 * categories feed one grid.
 */
export function dedupeProductsById(products: MockProduct[]): MockProduct[] {
  const seen = new Set<string>();
  return products.filter((product) => {
    if (seen.has(product.id)) return false;
    seen.add(product.id);
    return true;
  });
}

/**
 * All active products belonging to a top-level category.
 *
 * Covers BOTH placements, so a category whose products sit directly on the
 * parent works exactly like a nested one such as ירקות:
 *   • products assigned directly to the parent category, and
 *   • products assigned to any of its active child categories.
 *
 * This is what lets גלידות ופיצוחים show products filed under the combined
 * parent, under גלידות, or under פיצוחים — each appearing exactly once.
 */
export async function fetchProductsByParentCategorySlug(
  parentSlug: string
): Promise<MockProduct[]> {
  const supabase = createPublicClient();

  // Started first so it overlaps the category and product queries below.
  const promotionsPromise = fetchLivePromotions();

  // 1. Resolve parent slug → id
  const { data: parent, error: parentErr } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", parentSlug)
    .eq("is_active", true)
    .single();

  if (parentErr || !parent) return [];

  // 2. Fetch child category IDs (a top-level category may legitimately have none)
  const { data: children } = await supabase
    .from("categories")
    .select("id")
    .eq("parent_id", parent.id)
    .eq("is_active", true);

  // 3. Fetch products in the parent itself and in every child category
  const categoryIds = collectCategoryIds(parent.id, children);

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .in("category_id", categoryIds)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  const products = dedupeProductsById(
    (data as unknown as ProductRow[])
      .map(toMockProduct)
      .filter((p) => p.variants.length > 0)
  );

  return withPromotions(products, promotionsPromise);
}

/**
 * The /promotions collection — a dynamic virtual category, not a real
 * `category_id`. A product stays in its own category (a fruit is still a fruit)
 * and appears here for as long as at least one of these is true:
 *
 *   1. an available variant has a genuine sale price (compare_price_agorot),
 *   2. the product has an active legacy quantity deal (qty_deal_*), or
 *   3. an available variant belongs to a live group promotion.
 *
 * The moment the last qualifying condition disappears, the product drops out —
 * nothing has to be un-assigned by hand. Products are deduplicated, so a product
 * that qualifies through several conditions is still listed once.
 */
export async function fetchPromotionalProducts(): Promise<MockProduct[]> {
  const supabase = createPublicClient();

  const [promotions, { data, error }] = await Promise.all([
    fetchLivePromotions(),
    supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (error || !data) return [];

  const liveVariantIds = collectPromotionalVariantIds(promotions);

  const products = (data as unknown as ProductRow[])
    .map(toMockProduct)
    // toMockProduct already drops unavailable variants, so anything left here is
    // purchasable right now.
    .filter((p) => p.variants.length > 0)
    .filter((p) => isPromotionalProduct(p, liveVariantIds));

  return withPromotions(products, promotions);
}

/**
 * Fetch a single product by slug.
 */
export async function fetchProductBySlug(
  slug: string
): Promise<MockProduct | null> {
  const supabase = createPublicClient();

  // Started first so it overlaps the product query.
  const promotionsPromise = fetchLivePromotions();

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error || !data) return null;

  const [product] = await withPromotions(
    [toMockProduct(data as unknown as ProductRow)],
    promotionsPromise
  );
  return product ?? null;
}

/**
 * Featured products for homepage BestSellers section.
 */
export async function fetchFeaturedProducts(
  limit = 8
): Promise<MockProduct[]> {
  const supabase = createPublicClient();

  // Started first so it overlaps the product query.
  const promotionsPromise = fetchLivePromotions();

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_active", true)
    .eq("is_featured", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error || !data) return [];

  return withPromotions(
    (data as unknown as ProductRow[]).map(toMockProduct).filter((p) => p.variants.length > 0),
    promotionsPromise
  );
}

/**
 * Every active product across all categories.
 * Backs the navbar search catalog and the /search results page.
 */
export async function fetchAllProducts(): Promise<MockProduct[]> {
  const supabase = createPublicClient();

  // Started first so it overlaps the product query.
  const promotionsPromise = fetchLivePromotions();

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return withPromotions(
    (data as unknown as ProductRow[]).map(toMockProduct).filter((p) => p.variants.length > 0),
    promotionsPromise
  );
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
