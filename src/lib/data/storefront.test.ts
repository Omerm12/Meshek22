import { describe, expect, it } from "vitest";
import { collectCategoryIds, dedupeProductsById } from "@/lib/data/storefront";
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
