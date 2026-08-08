import { describe, expect, it } from "vitest";
import {
  buildVariantPromotionMap,
  calculateCartPricing,
  formatPromotionProgress,
  isPromotionLive,
} from "@/lib/promotions/engine";
import type { PricedItem, Promotion } from "@/lib/promotions/types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = new Date("2026-08-08T12:00:00.000Z");

function makePromotion(overrides: Partial<Promotion> = {}): Promotion {
  return {
    id: "promo-4-for-10",
    name: "4 ב־10 ₪",
    description: null,
    promotionType: "mix_and_match_quantity",
    requiredQuantity: 4,
    bundlePriceAgorot: 1000, // ₪10
    isActive: true,
    startsAt: null,
    endsAt: null,
    sortOrder: 0,
    eligibleVariantIds: ["banana-unit", "cucumber-unit", "tomato-unit"],
    ...overrides,
  };
}

function makeItem(overrides: Partial<PricedItem> & { variantId: string }): PricedItem {
  return {
    productId: `product-of-${overrides.variantId}`,
    quantity: 1,
    priceAgorot: 400, // ₪4 per unit
    quantityPricingMode: "fixed",
    ...overrides,
  };
}

// ─── Live-window handling ─────────────────────────────────────────────────────

describe("isPromotionLive", () => {
  it("accepts a promotion with no date bounds", () => {
    expect(isPromotionLive(makePromotion(), NOW)).toBe(true);
  });

  it("rejects a disabled promotion", () => {
    expect(isPromotionLive(makePromotion({ isActive: false }), NOW)).toBe(false);
  });

  it("rejects a promotion that has not started yet", () => {
    const promo = makePromotion({ startsAt: "2026-09-01T00:00:00.000Z" });
    expect(isPromotionLive(promo, NOW)).toBe(false);
  });

  it("rejects an expired promotion", () => {
    const promo = makePromotion({ endsAt: "2026-08-01T00:00:00.000Z" });
    expect(isPromotionLive(promo, NOW)).toBe(false);
  });

  it("accepts a promotion inside its window", () => {
    const promo = makePromotion({
      startsAt: "2026-08-01T00:00:00.000Z",
      endsAt: "2026-09-01T00:00:00.000Z",
    });
    expect(isPromotionLive(promo, NOW)).toBe(true);
  });

  it("rejects a promotion with no eligible variants", () => {
    expect(isPromotionLive(makePromotion({ eligibleVariantIds: [] }), NOW)).toBe(false);
  });
});

// ─── Core mix-and-match behaviour ─────────────────────────────────────────────

describe("calculateCartPricing — mix and match", () => {
  it("applies the group promotion to 2 bananas + 2 cucumbers", () => {
    const result = calculateCartPricing(
      [
        makeItem({ variantId: "banana-unit", quantity: 2 }),
        makeItem({ variantId: "cucumber-unit", quantity: 2 }),
      ],
      [makePromotion()],
      NOW
    );

    // 4 units × ₪4 = ₪16 normally; the group costs ₪10 → ₪6 saved.
    expect(result.subtotalAgorot).toBe(1600);
    expect(result.discountAgorot).toBe(600);
    expect(result.chargedSubtotalAgorot).toBe(1000);
    expect(result.appliedPromotions).toHaveLength(1);
    expect(result.appliedPromotions[0].groupsApplied).toBe(1);
    expect(result.appliedPromotions[0].source).toBe("group");
  });

  it("applies the promotion twice for eight eligible units", () => {
    const result = calculateCartPricing(
      [
        makeItem({ variantId: "banana-unit", quantity: 4 }),
        makeItem({ variantId: "cucumber-unit", quantity: 4 }),
      ],
      [makePromotion()],
      NOW
    );

    // 8 × ₪4 = ₪32 normally; two groups at ₪10 = ₪20 → ₪12 saved.
    expect(result.subtotalAgorot).toBe(3200);
    expect(result.chargedSubtotalAgorot).toBe(2000);
    expect(result.discountAgorot).toBe(1200);
    expect(result.appliedPromotions[0].groupsApplied).toBe(2);
  });

  it("charges the remainder of five items at the normal price", () => {
    const result = calculateCartPricing(
      [makeItem({ variantId: "banana-unit", quantity: 5 })],
      [makePromotion()],
      NOW
    );

    // One group of 4 at ₪10, plus 1 leftover at ₪4 → ₪14 charged.
    expect(result.subtotalAgorot).toBe(2000);
    expect(result.chargedSubtotalAgorot).toBe(1400);
    expect(result.appliedPromotions[0].groupsApplied).toBe(1);
  });

  it("combines three different products into one qualifying group", () => {
    const result = calculateCartPricing(
      [
        makeItem({ variantId: "banana-unit", quantity: 2 }),
        makeItem({ variantId: "cucumber-unit", quantity: 1 }),
        makeItem({ variantId: "tomato-unit", quantity: 1 }),
      ],
      [makePromotion()],
      NOW
    );

    expect(result.chargedSubtotalAgorot).toBe(1000);
    expect(result.appliedPromotions[0].groupsApplied).toBe(1);
  });

  it("applies the bundle to the most expensive units so the customer saves most", () => {
    const result = calculateCartPricing(
      [
        makeItem({ variantId: "banana-unit", quantity: 4, priceAgorot: 900 }),
        makeItem({ variantId: "cucumber-unit", quantity: 1, priceAgorot: 100 }),
      ],
      [makePromotion()],
      NOW
    );

    // Normal: 4×₪9 + ₪1 = ₪37. Best grouping bundles the four ₪9 units for ₪10
    // and charges the ₪1 unit normally → ₪11.
    expect(result.subtotalAgorot).toBe(3700);
    expect(result.chargedSubtotalAgorot).toBe(1100);
  });

  it("does not apply a promotion that would raise the price", () => {
    const result = calculateCartPricing(
      [makeItem({ variantId: "banana-unit", quantity: 4, priceAgorot: 100 })],
      [makePromotion()], // ₪10 bundle vs ₪4 normal
      NOW
    );

    expect(result.discountAgorot).toBe(0);
    expect(result.chargedSubtotalAgorot).toBe(400);
    expect(result.appliedPromotions).toHaveLength(0);
  });

  it("ignores a variant that is not part of the promotion", () => {
    const result = calculateCartPricing(
      [
        makeItem({ variantId: "banana-unit", quantity: 3 }),
        makeItem({ variantId: "melon-unit", quantity: 5 }),
      ],
      [makePromotion()],
      NOW
    );

    expect(result.discountAgorot).toBe(0);
    expect(result.chargedSubtotalAgorot).toBe(result.subtotalAgorot);
  });

  it("does not apply an expired or disabled promotion", () => {
    const expired = makePromotion({ endsAt: "2026-08-01T00:00:00.000Z" });
    const disabled = makePromotion({ id: "p2", isActive: false });
    const items = [
      makeItem({ variantId: "banana-unit", quantity: 2 }),
      makeItem({ variantId: "cucumber-unit", quantity: 2 }),
    ];

    expect(calculateCartPricing(items, [expired], NOW).discountAgorot).toBe(0);
    expect(calculateCartPricing(items, [disabled], NOW).discountAgorot).toBe(0);
  });

  it("excludes per_kg variants from a fixed-unit group promotion", () => {
    const result = calculateCartPricing(
      [
        makeItem({
          variantId: "banana-unit",
          quantity: 4,
          quantityPricingMode: "per_kg",
          priceAgorot: 1200,
        }),
      ],
      [makePromotion()],
      NOW
    );

    expect(result.discountAgorot).toBe(0);
    expect(result.subtotalAgorot).toBe(4800);
  });

  it("never produces a negative line or cart total", () => {
    const result = calculateCartPricing(
      [
        makeItem({ variantId: "banana-unit", quantity: 4, priceAgorot: 500 }),
        makeItem({ variantId: "cucumber-unit", quantity: 4, priceAgorot: 500 }),
      ],
      [makePromotion({ bundlePriceAgorot: 0 })],
      NOW
    );

    expect(result.chargedSubtotalAgorot).toBe(0);
    for (const line of result.lines) {
      expect(line.chargedTotalAgorot).toBeGreaterThanOrEqual(0);
      expect(line.discountAgorot).toBeLessThanOrEqual(line.normalTotalAgorot);
    }
  });

  it("keeps per-line discounts summing exactly to the cart discount", () => {
    const result = calculateCartPricing(
      [
        makeItem({ variantId: "banana-unit", quantity: 3, priceAgorot: 333 }),
        makeItem({ variantId: "cucumber-unit", quantity: 3, priceAgorot: 777 }),
        makeItem({ variantId: "tomato-unit", quantity: 2, priceAgorot: 111 }),
      ],
      [makePromotion()],
      NOW
    );

    const lineSum = result.lines.reduce((s, l) => s + l.discountAgorot, 0);
    expect(lineSum).toBe(result.discountAgorot);

    const chargedSum = result.lines.reduce((s, l) => s + l.chargedTotalAgorot, 0);
    expect(chargedSum).toBe(result.chargedSubtotalAgorot);
  });

  it("is deterministic across repeated runs", () => {
    const items = [
      makeItem({ variantId: "tomato-unit", quantity: 3, priceAgorot: 250 }),
      makeItem({ variantId: "banana-unit", quantity: 4, priceAgorot: 250 }),
      makeItem({ variantId: "cucumber-unit", quantity: 2, priceAgorot: 250 }),
    ];
    const first = calculateCartPricing(items, [makePromotion()], NOW);
    const second = calculateCartPricing(items, [makePromotion()], NOW);
    expect(second).toEqual(first);
  });
});

// ─── Legacy per-product deals ─────────────────────────────────────────────────

describe("calculateCartPricing — legacy qty_deal fallback", () => {
  const legacyItem = makeItem({
    variantId: "magnum-unit",
    productId: "magnum",
    quantity: 4,
    priceAgorot: 400,
    dealEnabled: true,
    dealQuantity: 4,
    dealPriceAgorot: 1000,
  });

  it("still applies an existing enabled product deal", () => {
    const result = calculateCartPricing([legacyItem], [], NOW);
    expect(result.subtotalAgorot).toBe(1600);
    expect(result.chargedSubtotalAgorot).toBe(1000);
    expect(result.appliedPromotions[0].source).toBe("legacy");
  });

  it("charges the remainder at the normal price", () => {
    const result = calculateCartPricing([{ ...legacyItem, quantity: 5 }], [], NOW);
    expect(result.chargedSubtotalAgorot).toBe(1400);
  });

  it("does not stack a group promotion with the legacy deal on the same item", () => {
    const groupPromotion = makePromotion({
      id: "group-magnum",
      eligibleVariantIds: ["magnum-unit"],
      requiredQuantity: 4,
      bundlePriceAgorot: 1200,
    });

    const result = calculateCartPricing([legacyItem], [groupPromotion], NOW);

    // The group promotion wins; the legacy deal must not also fire.
    expect(result.appliedPromotions).toHaveLength(1);
    expect(result.appliedPromotions[0].source).toBe("group");
    expect(result.chargedSubtotalAgorot).toBe(1200);
  });
});

// ─── Progress messaging ───────────────────────────────────────────────────────

describe("promotion progress", () => {
  it("reports how many more items complete the group", () => {
    const result = calculateCartPricing(
      [makeItem({ variantId: "banana-unit", quantity: 2 })],
      [makePromotion()],
      NOW
    );

    expect(result.progress).toHaveLength(1);
    expect(result.progress[0].missingQuantity).toBe(2);
    expect(formatPromotionProgress(result.progress[0])).toBe(
      "הוסיפו עוד 2 פריטים לקבלת 4 ב־10 ₪"
    );
  });

  it("reports progress toward the next group once one is already applied", () => {
    const result = calculateCartPricing(
      [makeItem({ variantId: "banana-unit", quantity: 5 })],
      [makePromotion()],
      NOW
    );

    expect(result.progress[0].missingQuantity).toBe(3);
  });
});

// ─── Variant ownership ────────────────────────────────────────────────────────

describe("buildVariantPromotionMap", () => {
  it("gives a variant to only one promotion when two claim it", () => {
    const first = makePromotion({ id: "aaa", sortOrder: 0, eligibleVariantIds: ["shared"] });
    const second = makePromotion({ id: "bbb", sortOrder: 1, eligibleVariantIds: ["shared"] });

    const map = buildVariantPromotionMap([second, first], NOW);
    expect(map.get("shared")?.id).toBe("aaa");
    expect(map.size).toBe(1);
  });

  it("omits promotions that are not live", () => {
    const map = buildVariantPromotionMap([makePromotion({ isActive: false })], NOW);
    expect(map.size).toBe(0);
  });
});
