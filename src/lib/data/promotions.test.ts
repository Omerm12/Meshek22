import { describe, expect, it } from "vitest";
import {
  collectPromotionalVariantIds,
  isPromotionalProduct,
  type PromotionCandidate,
} from "@/lib/data/promotions";
import type { Promotion } from "@/lib/promotions/types";

function makeProduct(overrides: Partial<PromotionCandidate> = {}): PromotionCandidate {
  return {
    variants: [{ id: "variant-1", priceAgorot: 500, comparePriceAgorot: null }],
    dealEnabled: false,
    dealQuantity: null,
    dealPriceAgorot: null,
    ...overrides,
  };
}

function makePromotion(variantIds: string[]): Promotion {
  return {
    id: "promo-1",
    name: "4 ב־10 ₪",
    description: null,
    promotionType: "mix_and_match_quantity",
    requiredQuantity: 4,
    bundlePriceAgorot: 1000,
    isActive: true,
    startsAt: null,
    endsAt: null,
    sortOrder: 0,
    eligibleVariantIds: variantIds,
  };
}

const NO_PROMOTIONS = new Set<string>();

describe("/promotions membership", () => {
  it("excludes an ordinary product with no promotion of any kind", () => {
    expect(isPromotionalProduct(makeProduct(), NO_PROMOTIONS)).toBe(false);
  });

  it("includes a product whose variant has a real sale price", () => {
    const product = makeProduct({
      variants: [{ id: "variant-1", priceAgorot: 400, comparePriceAgorot: 600 }],
    });
    expect(isPromotionalProduct(product, NO_PROMOTIONS)).toBe(true);
  });

  it("ignores a compare price that is not actually a discount", () => {
    const notCheaper = makeProduct({
      variants: [{ id: "variant-1", priceAgorot: 600, comparePriceAgorot: 600 }],
    });
    const higherPrice = makeProduct({
      variants: [{ id: "variant-1", priceAgorot: 700, comparePriceAgorot: 600 }],
    });

    expect(isPromotionalProduct(notCheaper, NO_PROMOTIONS)).toBe(false);
    expect(isPromotionalProduct(higherPrice, NO_PROMOTIONS)).toBe(false);
  });

  it("includes a product with an active legacy quantity deal", () => {
    const product = makeProduct({
      dealEnabled: true,
      dealQuantity: 4,
      dealPriceAgorot: 1000,
    });
    expect(isPromotionalProduct(product, NO_PROMOTIONS)).toBe(true);
  });

  it("excludes a legacy deal that is switched off or misconfigured", () => {
    const disabled = makeProduct({ dealEnabled: false, dealQuantity: 4, dealPriceAgorot: 1000 });
    const noQuantity = makeProduct({ dealEnabled: true, dealQuantity: null, dealPriceAgorot: 1000 });
    const noPrice = makeProduct({ dealEnabled: true, dealQuantity: 4, dealPriceAgorot: null });

    expect(isPromotionalProduct(disabled, NO_PROMOTIONS)).toBe(false);
    expect(isPromotionalProduct(noQuantity, NO_PROMOTIONS)).toBe(false);
    expect(isPromotionalProduct(noPrice, NO_PROMOTIONS)).toBe(false);
  });

  it("includes a product whose variant belongs to a live group promotion", () => {
    const live = collectPromotionalVariantIds([makePromotion(["variant-1"])]);
    expect(isPromotionalProduct(makeProduct(), live)).toBe(true);
  });

  it("drops the product as soon as its last promotion is removed", () => {
    const product = makeProduct();
    const withPromotion = collectPromotionalVariantIds([makePromotion(["variant-1"])]);

    expect(isPromotionalProduct(product, withPromotion)).toBe(true);

    // The promotion is deleted, disabled or expires — fetchLivePromotions then
    // returns nothing, so the variant set is empty and the product leaves the page.
    const afterRemoval = collectPromotionalVariantIds([]);
    expect(isPromotionalProduct(product, afterRemoval)).toBe(false);
  });

  it("keeps a product listed while at least one of several reasons still holds", () => {
    const product = makeProduct({
      variants: [{ id: "variant-1", priceAgorot: 400, comparePriceAgorot: 600 }],
      dealEnabled: true,
      dealQuantity: 4,
      dealPriceAgorot: 1000,
    });
    const live = collectPromotionalVariantIds([makePromotion(["variant-1"])]);

    // Qualifies three ways at once; still one product, and still listed after two
    // of the three reasons disappear.
    expect(isPromotionalProduct(product, live)).toBe(true);
    expect(
      isPromotionalProduct(
        { ...product, dealEnabled: false, dealQuantity: null, dealPriceAgorot: null },
        NO_PROMOTIONS
      )
    ).toBe(true);
  });

  it("collects variant ids across several promotions without duplicates", () => {
    const ids = collectPromotionalVariantIds([
      makePromotion(["a", "b"]),
      { ...makePromotion(["b", "c"]), id: "promo-2" },
    ]);
    expect([...ids].sort()).toEqual(["a", "b", "c"]);
  });
});
