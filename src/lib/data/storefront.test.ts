import { describe, expect, it } from "vitest";
import { buildNavbarTree, collectCategoryIds, dedupeProductsById, toMockProduct } from "@/lib/data/storefront";
import { MORE_FROM_THE_FARM_SLUG } from "@/lib/config/nav-categories";
import type { MockProduct } from "@/lib/data/mock";

/**
 * The query behind every parent-category page, and specifically behind the
 * combined גלידות ופיצוחים page, which draws from three categories at once:
 * the combined parent plus the גלידות and פיצוחים children.
 */

const PARENT = "combined-parent-id";
const ICE_CREAMS = "ice-creams-child-id";
const NUTS = "nuts-child-id";

function makeProduct(id: string, overrides: Partial<MockProduct> = {}): MockProduct {
  return {
    id,
    name: `מוצר ${id}`,
    slug: id,
    description: "",
    categorySlug: "ice-creams-and-nuts",
    categoryName: "גלידות ופיצוחים",
    isFeatured: false,
    variants: [],
    imageColor: "#eee",
    icon: "🍦",
    imageUrl: null,
    dealEnabled: false,
    dealQuantity: null,
    dealPriceAgorot: null,
    ...overrides,
  };
}

describe("collectCategoryIds", () => {
  it("queries the parent and both children for the combined category", () => {
    const ids = collectCategoryIds(PARENT, [{ id: ICE_CREAMS }, { id: NUTS }]);
    expect(ids).toEqual([PARENT, ICE_CREAMS, NUTS]);
  });

  it("puts the parent first so directly-assigned products are always included", () => {
    const ids = collectCategoryIds(PARENT, [{ id: ICE_CREAMS }]);
    expect(ids[0]).toBe(PARENT);
    expect(ids).toContain(ICE_CREAMS);
  });

  it("still queries the parent when it has no children", () => {
    expect(collectCategoryIds(PARENT, [])).toEqual([PARENT]);
    expect(collectCategoryIds(PARENT, null)).toEqual([PARENT]);
    expect(collectCategoryIds(PARENT, undefined)).toEqual([PARENT]);
  });

  it("never repeats a category id", () => {
    // A malformed row listing the parent as its own child must not make the
    // parent's products be queried — and counted — twice.
    const ids = collectCategoryIds(PARENT, [{ id: PARENT }, { id: NUTS }, { id: NUTS }]);
    expect(ids).toEqual([PARENT, NUTS]);
  });
});

describe("dedupeProductsById", () => {
  it("lists a product once even if it arrives more than once", () => {
    const products = [
      makeProduct("banana-split"),
      makeProduct("cashews"),
      makeProduct("banana-split"),
    ];

    const result = dedupeProductsById(products);
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id)).toEqual(["banana-split", "cashews"]);
  });

  it("keeps the first occurrence, preserving the query's sort order", () => {
    const first = makeProduct("magnum", { name: "מגנום" });
    const duplicate = makeProduct("magnum", { name: "שכפול" });

    const [only] = dedupeProductsById([first, duplicate]);
    expect(only.name).toBe("מגנום");
  });

  it("leaves a list with no duplicates untouched", () => {
    const products = [makeProduct("a"), makeProduct("b"), makeProduct("c")];
    expect(dedupeProductsById(products).map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("handles an empty list", () => {
    expect(dedupeProductsById([])).toEqual([]);
  });

  it("keeps products from the parent and from both children", () => {
    // What the combined page receives: one product filed directly on the
    // parent, one under גלידות, one under פיצוחים.
    const products = [
      makeProduct("mixed-tray", { categorySlug: "ice-creams-and-nuts" }),
      makeProduct("vanilla-tub", { categorySlug: "ice-creams" }),
      makeProduct("roasted-almonds", { categorySlug: "nuts" }),
    ];

    const result = dedupeProductsById(products);
    expect(result).toHaveLength(3);
    expect(result.map((p) => p.categorySlug)).toEqual([
      "ice-creams-and-nuts",
      "ice-creams",
      "nuts",
    ]);
  });
});

// ─── buildNavbarTree: the storefront navbar's category tree ──────────────────
//
// Pure rows-in/tree-out transformation behind fetchNavbarCategoryTree() — the
// single query that replaced Header.tsx's static PARENT_CATEGORY_NAV import.

type NavRow = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  sort_order: number;
  show_in_navbar: boolean;
  show_as_top_level_nav: boolean;
};

function navRow(overrides: Partial<NavRow> = {}): NavRow {
  return {
    id: "row-1",
    name: "קטגוריה",
    slug: "category",
    parent_id: null,
    sort_order: 0,
    show_in_navbar: true,
    show_as_top_level_nav: false,
    ...overrides,
  };
}

describe("buildNavbarTree", () => {
  it("includes an active parent flagged show_in_navbar, with its flagged children", () => {
    const rows = [
      navRow({ id: "veg", slug: "vegetables", name: "ירקות", show_in_navbar: true }),
      navRow({ id: "mushrooms", slug: "mushrooms", name: "פטריות", parent_id: "veg", show_in_navbar: true }),
    ];

    const tree = buildNavbarTree(rows);
    expect(tree).toHaveLength(1);
    expect(tree[0].slug).toBe("vegetables");
    expect(tree[0].children.map((c) => c.slug)).toEqual(["mushrooms"]);
  });

  it("excludes a parent with show_in_navbar = false, even though it is active", () => {
    const rows = [navRow({ id: "veg", slug: "vegetables", show_in_navbar: false })];
    expect(buildNavbarTree(rows)).toEqual([]);
  });

  it("a hidden parent's children never leak into the menu, even if a child is itself flagged show_in_navbar = true", () => {
    const rows = [
      navRow({ id: "veg", slug: "vegetables", show_in_navbar: false }),
      navRow({ id: "mushrooms", slug: "mushrooms", parent_id: "veg", show_in_navbar: true }),
    ];
    expect(buildNavbarTree(rows)).toEqual([]);
  });

  it("a shown parent can still hide one specific child", () => {
    const rows = [
      navRow({ id: "veg", slug: "vegetables", show_in_navbar: true }),
      navRow({ id: "shown", slug: "shown-child", parent_id: "veg", show_in_navbar: true }),
      navRow({ id: "hidden", slug: "hidden-child", parent_id: "veg", show_in_navbar: false }),
    ];

    const tree = buildNavbarTree(rows);
    expect(tree[0].children.map((c) => c.slug)).toEqual(["shown-child"]);
  });

  it("shows a brand-new child with no hardcoded slug — any slug under a shown parent qualifies", () => {
    const rows = [
      navRow({ id: "veg", slug: "vegetables", show_in_navbar: true }),
      navRow({
        id: "new",
        slug: "some-brand-new-category-nobody-hardcoded",
        parent_id: "veg",
        show_in_navbar: true,
      }),
    ];

    const tree = buildNavbarTree(rows);
    expect(tree[0].children.map((c) => c.slug)).toContain(
      "some-brand-new-category-nobody-hardcoded"
    );
  });

  it("gives a child an href using the ?sub= pattern off its parent's resolved href", () => {
    const rows = [
      navRow({ id: "veg", slug: "vegetables", show_in_navbar: true }),
      navRow({ id: "mushrooms", slug: "mushrooms", parent_id: "veg", show_in_navbar: true }),
    ];

    const tree = buildNavbarTree(rows);
    expect(tree[0].href).toBe("/vegetables");
    expect(tree[0].children[0].href).toBe("/vegetables?sub=mushrooms");
  });

  it("routes a top-level category with no dedicated page through the generic /category/[slug] route", () => {
    const rows = [
      navRow({ id: "brand-new", slug: "dairy", name: "מוצרי חלב", show_in_navbar: true }),
      navRow({ id: "dairy-child", slug: "yogurt", parent_id: "brand-new", show_in_navbar: true }),
    ];
    const tree = buildNavbarTree(rows);
    expect(tree[0].href).toBe("/category/dairy");
    expect(tree[0].children[0].href).toBe("/category/dairy?sub=yogurt");
  });

  it("keeps the existing dedicated routes for vegetables, fruits and more-from-the-farm", () => {
    const rows = [
      navRow({ id: "v", slug: "vegetables", show_in_navbar: true }),
      navRow({ id: "f", slug: "fruits", show_in_navbar: true }),
      navRow({ id: "m", slug: "more-from-the-farm", show_in_navbar: true }),
    ];
    const tree = buildNavbarTree(rows);
    const hrefBySlug = new Map(tree.map((c) => [c.slug, c.href]));
    expect(hrefBySlug.get("vegetables")).toBe("/vegetables");
    expect(hrefBySlug.get("fruits")).toBe("/fruits");
    expect(hrefBySlug.get("more-from-the-farm")).toBe("/more-from-the-farm");
  });

  it("returns an empty tree for empty input, and never throws", () => {
    expect(buildNavbarTree([])).toEqual([]);
  });
});

// ─── buildNavbarTree: promoting a child to also appear at the top level ──────
//
// show_as_top_level_nav is independent of show_in_navbar: a child can be in
// its parent's submenu, at the top level, both, or neither.

describe("buildNavbarTree: top-level promotion", () => {
  it("a promoted child appears both inside its parent's submenu and as its own top-level heading", () => {
    const rows = [
      navRow({ id: "veg", slug: "vegetables", show_in_navbar: true }),
      navRow({
        id: "mushrooms",
        slug: "mushrooms-pack",
        name: "פטריות",
        parent_id: "veg",
        show_in_navbar: true,
        show_as_top_level_nav: true,
      }),
    ];

    const tree = buildNavbarTree(rows);
    const vegetables = tree.find((n) => n.slug === "vegetables")!;
    expect(vegetables.children.map((c) => c.slug)).toEqual(["mushrooms-pack"]);

    const promoted = tree.find((n) => n.slug === "mushrooms-pack");
    expect(promoted).toBeDefined();
    expect(promoted!.children).toEqual([]);
  });

  it("promoted child never gets its own parent_id changed — it links to its real parent's route, not a root route of its own", () => {
    const rows = [
      navRow({ id: "veg", slug: "vegetables", show_in_navbar: true }),
      navRow({
        id: "mushrooms",
        slug: "mushrooms-pack",
        parent_id: "veg",
        show_as_top_level_nav: true,
      }),
    ];

    const tree = buildNavbarTree(rows);
    const promoted = tree.find((n) => n.slug === "mushrooms-pack")!;
    expect(promoted.href).toBe("/vegetables?sub=mushrooms-pack");
  });

  it("URL-encodes the promoted child's slug in its query value", () => {
    const rows = [
      navRow({ id: "veg", slug: "vegetables", show_in_navbar: true }),
      navRow({ id: "odd", slug: "a b/c", parent_id: "veg", show_as_top_level_nav: true }),
    ];

    const tree = buildNavbarTree(rows);
    const promoted = tree.find((n) => n.slug === "a b/c")!;
    expect(promoted.href).toBe(`/vegetables?sub=${encodeURIComponent("a b/c")}`);
  });

  it("promoted children are inserted after fruits and before עוד מהמשק, per the required order", () => {
    const rows = [
      navRow({ id: "veg", slug: "vegetables", sort_order: 1, show_in_navbar: true }),
      navRow({ id: "fru", slug: "fruits", sort_order: 2, show_in_navbar: true }),
      navRow({ id: "farm", slug: MORE_FROM_THE_FARM_SLUG, sort_order: 3, show_in_navbar: true }),
      navRow({
        id: "mushrooms",
        slug: "mushrooms-pack",
        parent_id: "veg",
        show_as_top_level_nav: true,
      }),
    ];

    const tree = buildNavbarTree(rows);
    expect(tree.map((n) => n.slug)).toEqual([
      "vegetables",
      "fruits",
      "mushrooms-pack",
      MORE_FROM_THE_FARM_SLUG,
    ]);
  });

  it("multiple promoted children are ordered by sort_order, with name as a stable secondary key — not query return order", () => {
    const rows = [
      navRow({ id: "veg", slug: "vegetables", sort_order: 1, show_in_navbar: true }),
      navRow({ id: "farm", slug: MORE_FROM_THE_FARM_SLUG, sort_order: 2, show_in_navbar: true }),
      // Deliberately inserted out of the order they should end up in.
      navRow({
        id: "c",
        slug: "third",
        name: "ג",
        parent_id: "veg",
        sort_order: 30,
        show_as_top_level_nav: true,
      }),
      navRow({
        id: "a",
        slug: "first",
        name: "א",
        parent_id: "veg",
        sort_order: 10,
        show_as_top_level_nav: true,
      }),
      navRow({
        id: "b-tie-1",
        slug: "second-a",
        name: "ב1",
        parent_id: "veg",
        sort_order: 20,
        show_as_top_level_nav: true,
      }),
      navRow({
        id: "b-tie-2",
        slug: "second-b",
        name: "ב2",
        parent_id: "veg",
        sort_order: 20,
        show_as_top_level_nav: true,
      }),
    ];

    const tree = buildNavbarTree(rows);
    const promotedSlugs = tree
      .filter((n) => n.slug !== "vegetables" && n.slug !== MORE_FROM_THE_FARM_SLUG)
      .map((n) => n.slug);
    expect(promotedSlugs).toEqual(["first", "second-a", "second-b", "third"]);
  });

  it("appends the promoted block after all root categories when there is no עוד מהמשק root shown", () => {
    const rows = [
      navRow({ id: "veg", slug: "vegetables", sort_order: 1, show_in_navbar: true }),
      navRow({ id: "fru", slug: "fruits", sort_order: 2, show_in_navbar: true }),
      navRow({ id: "mushrooms", slug: "mushrooms-pack", parent_id: "veg", show_as_top_level_nav: true }),
    ];

    const tree = buildNavbarTree(rows);
    expect(tree.map((n) => n.slug)).toEqual(["vegetables", "fruits", "mushrooms-pack"]);
  });

  it("turning off show_as_top_level_nav removes only the top-level entry — the child stays in its parent's submenu", () => {
    const rows = [
      navRow({ id: "veg", slug: "vegetables", show_in_navbar: true }),
      navRow({
        id: "mushrooms",
        slug: "mushrooms-pack",
        parent_id: "veg",
        show_in_navbar: true,
        show_as_top_level_nav: false,
      }),
    ];

    const tree = buildNavbarTree(rows);
    expect(tree.map((n) => n.slug)).toEqual(["vegetables"]);
    expect(tree[0].children.map((c) => c.slug)).toEqual(["mushrooms-pack"]);
  });

  it("turning off show_in_navbar hides the child from the submenu while it remains promoted at the top level", () => {
    const rows = [
      navRow({ id: "veg", slug: "vegetables", show_in_navbar: true }),
      navRow({
        id: "mushrooms",
        slug: "mushrooms-pack",
        parent_id: "veg",
        show_in_navbar: false,
        show_as_top_level_nav: true,
      }),
    ];

    const tree = buildNavbarTree(rows);
    expect(tree[0].children).toEqual([]);
    expect(tree.some((n) => n.slug === "mushrooms-pack")).toBe(true);
  });

  it("an inactive promoted child (simulated: absent from the active-only rows) never appears anywhere", () => {
    // buildNavbarTree trusts its caller to pass only is_active = true rows —
    // an inactive category is simply never in the input.
    const rows = [navRow({ id: "veg", slug: "vegetables", show_in_navbar: true })];
    const tree = buildNavbarTree(rows);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toEqual([]);
  });

  it("does not duplicate a root category that has show_as_top_level_nav = true on its own row", () => {
    // show_as_top_level_nav is only read from child rows (parent_id set); a
    // root row's own flag — however it got set — is never consulted.
    const rows = [
      navRow({ id: "veg", slug: "vegetables", show_in_navbar: true, show_as_top_level_nav: true }),
    ];
    const tree = buildNavbarTree(rows);
    expect(tree).toHaveLength(1);
    expect(tree.filter((n) => n.slug === "vegetables")).toHaveLength(1);
  });

  it("skips a promoted child whose parent row is not present in the active-only set", () => {
    const rows = [
      // No "veg" root row at all — its parent is inactive/absent.
      navRow({ id: "mushrooms", slug: "mushrooms-pack", parent_id: "veg", show_as_top_level_nav: true }),
    ];
    const tree = buildNavbarTree(rows);
    expect(tree).toEqual([]);
  });

  it("a promoted child can appear at the top level even when its own parent is hidden from the navbar", () => {
    const rows = [
      navRow({ id: "veg", slug: "vegetables", show_in_navbar: false }),
      navRow({
        id: "mushrooms",
        slug: "mushrooms-pack",
        parent_id: "veg",
        show_as_top_level_nav: true,
      }),
    ];

    const tree = buildNavbarTree(rows);
    expect(tree.map((n) => n.slug)).toEqual(["mushrooms-pack"]);
    expect(tree[0].href).toBe("/vegetables?sub=mushrooms-pack");
  });

  it("never appears twice at the top level even if somehow flagged from two angles", () => {
    const rows = [
      navRow({ id: "veg", slug: "vegetables", show_in_navbar: true }),
      navRow({
        id: "mushrooms",
        slug: "mushrooms-pack",
        parent_id: "veg",
        show_in_navbar: true,
        show_as_top_level_nav: true,
      }),
    ];
    const tree = buildNavbarTree(rows);
    const topLevelMatches = tree.filter((n) => n.slug === "mushrooms-pack");
    expect(topLevelMatches).toHaveLength(1);
  });
});

// ─── toMockProduct: initial variant selection ─────────────────────────────────
//
// A product offering a kilogram option must always open on it, no matter
// which variant the admin flagged is_default in the database, and no matter
// what order the rows come back in. This is the row→MockProduct mapping every
// storefront surface (product cards, category/search/promotions pages, the
// product page) is fed from — fixing it here fixes all of them at once.

type TestVariantRow = {
  id: string;
  label: string;
  unit: string;
  price_agorot: number;
  compare_price_agorot: number | null;
  is_default: boolean;
  is_available: boolean;
  sort_order: number;
  quantity_pricing_mode: "per_kg" | "fixed";
  quantity_step: number;
  min_quantity: number;
};

function variantRow(overrides: Partial<TestVariantRow> = {}): TestVariantRow {
  return {
    id: "variant-1",
    label: "יחידה",
    unit: "unit",
    price_agorot: 500,
    compare_price_agorot: null,
    is_default: false,
    is_available: true,
    sort_order: 0,
    quantity_pricing_mode: "fixed",
    quantity_step: 1,
    min_quantity: 1,
    ...overrides,
  };
}

function productRow(variants: TestVariantRow[]) {
  return {
    id: "product-1",
    name: "עגבניות",
    slug: "tomatoes",
    description: null,
    image_url: null,
    is_featured: false,
    sort_order: 0,
    created_at: "2026-01-01T00:00:00Z",
    qty_deal_enabled: false,
    qty_deal_quantity: null,
    qty_deal_price_agorot: null,
    categories: null,
    product_variants: variants,
  };
}

describe("toMockProduct: kilogram-first initial selection", () => {
  it("selects 1kg when it and יחידה both exist, even though יחידה is flagged is_default", () => {
    const row = productRow([
      variantRow({ id: "unit", unit: "unit", label: "יחידה", is_default: true, sort_order: 0 }),
      variantRow({ id: "kg", unit: "1kg", label: '1 ק"ג', is_default: false, sort_order: 1, price_agorot: 1290 }),
    ]);

    const product = toMockProduct(row);
    const selected = product.variants.find((v) => v.isDefault);
    expect(selected?.id).toBe("kg");
    // Only one variant may end up flagged default.
    expect(product.variants.filter((v) => v.isDefault)).toHaveLength(1);
  });

  it("still selects 1kg when it appears first in the database order (order must not matter)", () => {
    const row = productRow([
      variantRow({ id: "kg", unit: "1kg", label: '1 ק"ג', is_default: false, sort_order: 0 }),
      variantRow({ id: "unit", unit: "unit", label: "יחידה", is_default: true, sort_order: 1 }),
    ]);

    expect(selectedVariantId(row)).toBe("kg");
  });

  it("selects יחידה when it is the only option", () => {
    const row = productRow([
      variantRow({ id: "unit", unit: "unit", label: "יחידה", is_default: true }),
    ]);

    expect(selectedVariantId(row)).toBe("unit");
  });

  it("ignores an inactive (is_available: false) kilogram variant", () => {
    const row = productRow([
      variantRow({ id: "unit", unit: "unit", label: "יחידה", is_default: true, sort_order: 0 }),
      variantRow({
        id: "kg",
        unit: "1kg",
        label: '1 ק"ג',
        is_default: false,
        is_available: false,
        sort_order: 1,
      }),
    ]);

    const product = toMockProduct(row);
    // The inactive kg variant is dropped entirely, same as any other
    // unavailable variant — never shown, never selectable.
    expect(product.variants.map((v) => v.id)).toEqual(["unit"]);
    expect(selectedVariantId(row)).toBe("unit");
  });

  it("the selected kilogram variant carries its own price and label", () => {
    const row = productRow([
      variantRow({ id: "unit", unit: "unit", label: "יחידה", is_default: true, price_agorot: 500 }),
      variantRow({ id: "kg", unit: "1kg", label: '1 ק"ג', is_default: false, price_agorot: 1290, sort_order: 1 }),
    ]);

    const product = toMockProduct(row);
    const selected = product.variants.find((v) => v.isDefault);
    expect(selected).toMatchObject({ id: "kg", label: '1 ק"ג', priceAgorot: 1290 });
  });
});

function selectedVariantId(row: ReturnType<typeof productRow>): string | undefined {
  return toMockProduct(row).variants.find((v) => v.isDefault)?.id;
}
