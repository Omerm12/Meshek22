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
import { MORE_FROM_THE_FARM_SLUG } from "@/lib/config/nav-categories";
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
 * The homepage "מה תרצו היום?" section: an explicit, fixed list of three cards.
 *
 * Each entry names the category by SLUG — the stable identifier — so nothing
 * here depends on `is_featured`, on row order, or on partial name matching, and
 * no category outside this list can ever appear. There is deliberately no
 * "show everything" fallback: the section previously used one, and because no
 * row is flagged is_featured it rendered all eleven active top-level categories,
 * including two different rows both named ירקות (`vegetables` and a stray
 * `yerakot`) plus seven `cat-*` rows that have no landing page.
 *
 * `label` overrides the database name where the two intentionally differ, and
 * `includesChildren` mirrors how the destination page selects its products, so
 * a card's number always equals what the customer finds after clicking it:
 *   • true  → fetchProductsByParentCategorySlug(): the category AND its active
 *             direct children (what /vegetables, /fruits and
 *             /more-from-the-farm all render)
 *   • false → fetchProductsByCategory(): that category only
 */
const HOMEPAGE_CARDS: {
  slug: string;
  label?: string;
  includesChildren: boolean;
}[] = [
  { slug: "vegetables", includesChildren: true },
  { slug: "fruits", includesChildren: true },
  // "עוד מהמשק": the renamed ice-creams-and-nuts parent plus its seven child
  // categories (some of which start out empty until products are filed under
  // them) — same includesChildren pattern as vegetables/fruits above.
  { slug: MORE_FROM_THE_FARM_SLUG, includesChildren: true },
];

/**
 * The three homepage cards, each carrying the number of products a customer
 * will actually find on its destination page.
 *
 * The count mirrors what the destination page renders, so the two can never
 * disagree:
 *   • only active products,
 *   • only products with at least one AVAILABLE variant — the category pages
 *     drop the rest via `.filter(p => p.variants.length > 0)`,
 *   • the category itself, plus its active direct children only when the
 *     destination page includes them (see includesChildren above),
 *   • each product counted once: a product has a single category_id, and the
 *     `!inner` embed returns one row per product however many variants match.
 *
 * Two queries in parallel regardless of card count — no per-category round-trip.
 * Nothing is hardcoded: adding, removing, activating, deactivating or moving a
 * product changes the number on the next render.
 */
export async function fetchHomepageCategories(): Promise<MockCategory[]> {
  const supabase = createPublicClient();

  const [categoriesResult, productsResult] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, slug, description, parent_id")
      .eq("is_active", true),
    supabase
      .from("products")
      .select("id, category_id, product_variants!inner(id)")
      .eq("is_active", true)
      .eq("product_variants.is_available", true),
  ]);

  const categoryRows = (categoriesResult.data ?? []) as CategoryRow[];
  const productRows = (productsResult.data ?? []) as unknown as { category_id: string }[];

  // Products per category id.
  const countByCategory = new Map<string, number>();
  for (const product of productRows) {
    countByCategory.set(product.category_id, (countByCategory.get(product.category_id) ?? 0) + 1);
  }

  // Active direct children per parent id.
  const childrenByParent = new Map<string, string[]>();
  for (const category of categoryRows) {
    if (!category.parent_id) continue;
    const siblings = childrenByParent.get(category.parent_id) ?? [];
    siblings.push(category.id);
    childrenByParent.set(category.parent_id, siblings);
  }

  const bySlug = new Map(categoryRows.map((c) => [c.slug, c]));

  return HOMEPAGE_CARDS.map(({ slug, label, includesChildren }) => {
    const row = bySlug.get(slug);
    const display = getCategoryDisplay(slug);

    // A homepage card's underlying category row may not exist yet if its
    // migration has not been applied in this environment — e.g. more-from-the-farm
    // is created by 20260906_more_from_the_farm_categories.sql. Until it runs the
    // row does not exist, but its page does, so the card is still shown — with a
    // count of 0, which is exactly what that page renders. The number is never
    // invented.
    if (!row) {
      return {
        id: `missing:${slug}`,
        name: label ?? slug,
        slug,
        description: "",
        icon: display.icon,
        color: display.color,
        textColor: display.textColor,
        count: 0,
        parentId: null,
      };
    }

    const ids = includesChildren
      ? [row.id, ...(childrenByParent.get(row.id) ?? [])]
      : [row.id];
    const count = ids.reduce((total, id) => total + (countByCategory.get(id) ?? 0), 0);

    return { ...toMockCategory(row), name: label ?? row.name, count };
  });
}

// fetchFeaturedCategories() was removed here. It was the homepage section's
// previous data source and is what produced the eleven-card list: no row is
// flagged is_featured, so it always fell through to its "show every active
// top-level category" fallback. fetchHomepageCategories() above replaces it and
// is the only function the section calls. Leaving the old one in place would
// have left two plausible-looking paths for the same section, with no way to
// tell from the file which one the page actually renders.

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
 * the schema, which matters for a page like עוד מהמשק where up to eight
 * categories (the parent plus its seven children) feed one grid.
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
 * This is what lets עוד מהמשק show products filed directly under its own
 * (renamed, formerly combined) parent row alongside products filed under any
 * of its seven child categories — each appearing exactly once.
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
