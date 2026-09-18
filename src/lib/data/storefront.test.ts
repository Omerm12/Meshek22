import { describe, expect, it } from "vitest";
import { collectCategoryIds, dedupeProductsById, toMockProduct } from "@/lib/data/storefront";
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
