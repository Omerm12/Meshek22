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
 *   fetchCategoryTree()                   – full parent→children tree
 *   fetchParentCategoryPageData()         – everything a parent category page
 *                                           (fruits/vegetables/more-from-the-farm)
 *                                           needs: subcategories, the validated
 *                                           ?sub= slug, and products assigned to
 *                                           the parent itself AND to any child
 *                                           category — one cached categories
 *                                           lookup shared by every caller
 *   fetchPromotionalProducts()            – the dynamic /promotions collection
 *   fetchNavbarCategoryTree()             – the header's parent→children tree,
 *                                           filtered by is_active + show_in_navbar
 */

import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { getCategoryDisplay, getProductDisplay } from "@/lib/product-display";
import {
  collectPromotionalVariantIds,
  fetchLivePromotions,
  isPromotionalProduct,
} from "@/lib/data/promotions";
import { buildVariantPromotionMap } from "@/lib/promotions/engine";
import { MORE_FROM_THE_FARM_SLUG, resolveParentCategoryHref } from "@/lib/config/nav-categories";
import { pickInitialVariant } from "@/lib/data/variant-selection";
import { computeNavbarVersion } from "@/lib/utils/nav-version";
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

export function toMockProduct(row: ProductRow): MockProduct {
  const catSlug = row.categories?.slug ?? "vegetables";
  const display = getProductDisplay(row.slug);

  const availableVariants: MockVariant[] = row.product_variants
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

  // A kilogram variant always opens selected, regardless of which variant an
  // admin flagged is_default — see pickInitialVariant() for the full rule.
  // Recomputing isDefault here (rather than only patching in a missing one)
  // means every consumer that already trusts `variants.find(v => v.isDefault)`
  // — every product card, the product page, search results, category and
  // promotions pages — gets the fix for free, with no component changes.
  const initial = pickInitialVariant(availableVariants);
  const variants: MockVariant[] = availableVariants.map((v) => ({
    ...v,
    isDefault: v.id === initial?.id,
  }));

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
 *   • true  → the category AND its active direct children (what /vegetables,
 *             /fruits and /more-from-the-farm all render on their "הכל" tab)
 *   • false → that category only
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

// ─── Navbar category tree ───────────────────────────────────────────────────────

type NavbarCategorySourceRow = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  sort_order: number;
  show_in_navbar: boolean;
  show_as_top_level_nav: boolean;
};

export interface NavCategoryChild {
  id: string;
  name: string;
  slug: string;
  href: string;
}

export interface NavCategoryNode extends NavCategoryChild {
  icon: string;
  children: NavCategoryChild[];
}

/** sort_order ascending, then name (Hebrew collation) as a stable tiebreak. */
function bySortOrderThenName(a: NavbarCategorySourceRow, b: NavbarCategorySourceRow): number {
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  return a.name.localeCompare(b.name, "he");
}

/**
 * Build one root-level navbar entry: its own link, plus its active
 * show_in_navbar-flagged children for the submenu.
 */
function buildRootNode(
  parent: NavbarCategorySourceRow,
  children: NavbarCategorySourceRow[]
): NavCategoryNode {
  const href = resolveParentCategoryHref(parent.slug);
  return {
    id: parent.id,
    name: parent.name,
    slug: parent.slug,
    href,
    icon: getCategoryDisplay(parent.slug).icon,
    children: children
      .filter((child) => child.show_in_navbar)
      .map((child) => ({
        id: child.id,
        name: child.name,
        slug: child.slug,
        href: `${href}?sub=${encodeURIComponent(child.slug)}`,
      })),
  };
}

/**
 * Build one promoted-child navbar entry: a child category rendered as its
 * own top-level heading, linking straight to its actual parent page with its
 * slug preselected (e.g. /vegetables?sub=mushrooms-pack) — never a root
 * route of its own, since its parent_id is untouched.
 *
 * No dropdown: this schema has no third hierarchy level, so a promoted child
 * never has children of its own to show.
 */
function buildPromotedNode(
  child: NavbarCategorySourceRow,
  parent: NavbarCategorySourceRow
): NavCategoryNode {
  const parentHref = resolveParentCategoryHref(parent.slug);
  return {
    id: child.id,
    name: child.name,
    slug: child.slug,
    href: `${parentHref}?sub=${encodeURIComponent(child.slug)}`,
    icon: getCategoryDisplay(child.slug).icon,
    children: [],
  };
}

/**
 * Build the navbar's top-level list from every active category row: normal
 * root categories (show_in_navbar = true) plus any CHILD category promoted
 * to also appear at the top level (show_as_top_level_nav = true) — the same
 * category can legitimately appear in both its parent's submenu and as a
 * standalone top-level heading, per the two independent flags.
 *
 * Ordering: root categories keep their existing sort_order-driven order.
 * Promoted children are sorted among themselves by sort_order then name (a
 * stable, general rule — nothing here keys off any specific category's name
 * or slug), and spliced in as one block immediately before the
 * "עוד מהמשק" (MORE_FROM_THE_FARM_SLUG) root entry if it is currently
 * shown — that catch-all category is the one existing anchor point in this
 * app's navigation, so real product categories (root or promoted) stay
 * grouped together ahead of it. If that root entry isn't present, the
 * promoted block is simply appended after the other root categories.
 *
 * Promotion is read ONLY from child rows (parent_id set): a root category's
 * own show_as_top_level_nav is never consulted, so a root already shown via
 * show_in_navbar can never be duplicated. A promoted child whose parent row
 * isn't in this active-only row set (the parent itself is inactive) is
 * skipped — its link would have nowhere valid to resolve to.
 *
 * `is_active` is enforced by the caller (rows passed in must already be
 * active-only) — this function never re-checks it, so an inactive category
 * can never slip into the navbar via either path.
 *
 * Exported as a pure function (rows in, tree out) so it can be unit tested
 * without a Supabase client, the same pattern as collectCategoryIds /
 * dedupeProductsById above.
 */
export function buildNavbarTree(rows: NavbarCategorySourceRow[]): NavCategoryNode[] {
  const childrenByParent = new Map<string, NavbarCategorySourceRow[]>();
  const rootsById = new Map<string, NavbarCategorySourceRow>();
  for (const row of rows) {
    if (row.parent_id) {
      const siblings = childrenByParent.get(row.parent_id) ?? [];
      siblings.push(row);
      childrenByParent.set(row.parent_id, siblings);
    } else {
      rootsById.set(row.id, row);
    }
  }

  const rootNodes = rows
    .filter((row) => !row.parent_id && row.show_in_navbar)
    .map((parent) => buildRootNode(parent, childrenByParent.get(parent.id) ?? []));

  const promotedNodes = rows
    .filter((row) => row.parent_id && row.show_as_top_level_nav)
    .filter((row) => rootsById.has(row.parent_id!))
    .sort(bySortOrderThenName)
    .map((child) => buildPromotedNode(child, rootsById.get(child.parent_id!)!));

  const anchorIndex = rootNodes.findIndex((node) => node.slug === MORE_FROM_THE_FARM_SLUG);
  const insertAt = anchorIndex === -1 ? rootNodes.length : anchorIndex;

  return [...rootNodes.slice(0, insertAt), ...promotedNodes, ...rootNodes.slice(insertAt)];
}

/**
 * The storefront navbar's full top-level list (root categories plus any
 * promoted children), in one Supabase round trip: every active category
 * (parents and children together), grouped, filtered and ordered in JS by
 * buildNavbarTree() rather than one query per parent. No N+1 — this function
 * issues exactly one `.from("categories")` query no matter how many root
 * entries or promoted children end up in the menu.
 *
 * Cached alongside every other categories read (see
 * getCachedParentCategoryTree above) under the same "categories" tag, so an
 * admin toggling show_in_navbar, show_as_top_level_nav, is_active or
 * parent_id takes effect immediately via revalidateStorefront()'s
 * updateTag("categories") call — no separate invalidation path to maintain.
 */
const getCachedNavbarCategoryTree = unstable_cache(
  async (): Promise<NavCategoryNode[]> => {
    const supabase = createPublicClient();

    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug, parent_id, sort_order, show_in_navbar, show_as_top_level_nav")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      throw new Error(`Failed to load navbar categories: ${error.message}`);
    }

    return buildNavbarTree((data ?? []) as NavbarCategorySourceRow[]);
  },
  ["navbar-category-tree"],
  { revalidate: 60, tags: ["categories"] }
);

/**
 * Fetched once per request (from the (shop) layout for every shop page, and
 * from the homepage) and passed down as a prop — the desktop and mobile menus
 * inside Header both render from that same prop, so this is the only
 * Supabase round trip the navbar ever costs a page render, cache misses
 * aside. Never depends on cookies/session: uses createPublicClient() like
 * every other function in this file, so the navbar renders identically for
 * every visitor and Next.js can still statically optimise pages around it.
 */
export async function fetchNavbarCategoryTree(): Promise<NavCategoryNode[]> {
  return getCachedNavbarCategoryTree();
}

/**
 * A cheap fingerprint of the current navbar tree, for the client-side
 * freshness check in Header.tsx (see /api/nav/version). Calls the exact same
 * cached function as fetchNavbarCategoryTree() above — sharing its
 * unstable_cache entry rather than issuing a second Supabase query — so this
 * costs nothing beyond what the navbar was already going to fetch this
 * request/cache-window regardless of how many browser tabs poll it.
 */
export async function fetchNavbarVersion(): Promise<string> {
  const tree = await getCachedNavbarCategoryTree();
  return computeNavbarVersion(tree);
}

// ─── Product queries ───────────────────────────────────────────────────────────

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
 * Resolve a parent category (by slug) and its active children in a single
 * Supabase round trip: one query for every active category row, filtered and
 * grouped in JS, instead of a "parent by slug" query followed by a separate
 * "children by parent_id" query.
 *
 * Cached for 60s — the categories table changes only when an admin edits it,
 * and every parent-category page (fruits, vegetables, more-from-the-farm)
 * needs this same lookup on every request. This is the fix for the "categories
 * fetched 3 times for one page view" bug: previously each page resolved the
 * parent slug twice (once to validate ?sub=, once more inside the product
 * query), each resolution itself split into two sequential round trips, all
 * uncached. Wrapping the one query that replaces all of that means a page view
 * costs at most one /rest/v1/categories round trip, and most requests within
 * the cache window cost none at all.
 */
const getCachedParentCategoryTree = unstable_cache(
  async (
    parentSlug: string
  ): Promise<{ parent: CategoryRow | null; children: CategoryRow[] }> => {
    const supabase = createPublicClient();

    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug, description, parent_id")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      throw new Error(`Failed to load categories: ${error.message}`);
    }

    const rows = (data ?? []) as CategoryRow[];
    const parent = rows.find((r) => r.slug === parentSlug) ?? null;
    const children = parent ? rows.filter((r) => r.parent_id === parent.id) : [];

    return { parent, children };
  },
  ["parent-category-tree"],
  { revalidate: 60, tags: ["categories"] }
);

/**
 * Products for a specific set of category ids (a parent-plus-children query,
 * or a single validated child when a ?sub= tab is active).
 *
 * Cached for 60s per distinct set of ids — the same window the homepage and
 * /promotions already use for catalog data — so repeat visits to the same
 * category/tab don't re-query Supabase at all.
 */
const getCachedCategoryProducts = unstable_cache(
  async (categoryIds: string[]): Promise<MockProduct[]> => {
    const supabase = createPublicClient();

    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .in("category_id", categoryIds)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to load products: ${error.message}`);
    }

    return dedupeProductsById(
      (data as unknown as ProductRow[])
        .map(toMockProduct)
        .filter((p) => p.variants.length > 0)
    );
  },
  ["category-products-by-ids"],
  { revalidate: 60, tags: ["products"] }
);

export interface ParentCategoryPageData {
  subcategories: MockCategory[];
  /** The requested ?sub= slug, or null if absent/unrecognised. */
  activeSubSlug: string | null;
  products: MockProduct[];
}

/**
 * Everything a parent category page (/fruits, /vegetables,
 * /more-from-the-farm) needs, resolved in the minimum number of Supabase
 * round trips: one cached categories lookup (shared across every visitor and
 * every ?sub= tab), then one products query and one promotions query running
 * in parallel.
 *
 * A genuine Supabase error is thrown rather than swallowed into an empty
 * array. Swallowing it was the cause of the false "אין מוצרים" empty state:
 * a transient failure and a legitimately empty category both rendered
 * identically. Throwing here lets the nearest error boundary
 * (src/app/(shop)/error.tsx) handle real failures, so "no products" is only
 * ever shown after a load that actually succeeded.
 */
export async function fetchParentCategoryPageData(
  parentSlug: string,
  requestedSubSlug: string | null
): Promise<ParentCategoryPageData> {
  const { parent, children } = await getCachedParentCategoryTree(parentSlug);

  const subcategories = children.map(toMockCategory);
  const activeSubSlug =
    requestedSubSlug && subcategories.some((c) => c.slug === requestedSubSlug)
      ? requestedSubSlug
      : null;

  if (!parent) {
    return { subcategories, activeSubSlug, products: [] };
  }

  // Started first so it overlaps the product query.
  const promotionsPromise = fetchLivePromotions();

  const activeChild = activeSubSlug
    ? children.find((c) => c.slug === activeSubSlug)
    : undefined;
  const categoryIds = activeChild
    ? [activeChild.id]
    : collectCategoryIds(parent.id, children);

  const products = await getCachedCategoryProducts(categoryIds);

  return {
    subcategories,
    activeSubSlug,
    products: await withPromotions(products, promotionsPromise),
  };
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
