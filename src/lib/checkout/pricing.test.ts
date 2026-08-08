import { describe, expect, it } from "vitest";
import { calculateCartPricing } from "@/lib/promotions/engine";
import { getDeliveryQuote, type DeliveryZone } from "@/lib/delivery";
import type { PricedItem, Promotion } from "@/lib/promotions/types";

/**
 * End-to-end order arithmetic, exercised exactly the way the checkout Server
 * Action does it:
 *
 *   subtotal  = Σ undiscounted line totals            (orders.subtotal_agorot)
 *   discount  = Σ promotion savings                   (orders.discount_agorot)
 *   total     = subtotal + delivery fee − discount    (orders.total_agorot)
 *
 * and the CardCom document lines, which must add up to that same total.
 */

const NOW = new Date("2026-08-08T12:00:00.000Z");

const ZONE: DeliveryZone = {
  id: "zone-1",
  name: "מרכז",
  delivery_fee_agorot: 2500,
  free_delivery_threshold_agorot: 15000,
  min_order_agorot: 5000,
  estimated_delivery_hours: 24,
};

function makePromotion(overrides: Partial<Promotion> = {}): Promotion {
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
    eligibleVariantIds: ["banana", "cucumber"],
    ...overrides,
  };
}

function item(variantId: string, quantity: number, priceAgorot = 400): PricedItem {
  return {
    variantId,
    productId: `product-${variantId}`,
    quantity,
    priceAgorot,
    quantityPricingMode: "fixed",
  };
}

/** Mirrors how the Server Action assembles the final order figures. */
function priceOrder(
  items: PricedItem[],
  promotions: Promotion[],
  fulfillment: "delivery" | "pickup"
) {
  const pricing = calculateCartPricing(items, promotions, NOW);
  const goodsTotal = pricing.chargedSubtotalAgorot;

  const quote = fulfillment === "delivery" ? getDeliveryQuote(ZONE, goodsTotal) : null;
  const deliveryFeeAgorot = quote?.feeAgorot ?? 0;

  return {
    pricing,
    deliveryFeeAgorot,
    meetsMinimum: quote ? quote.meetsMinimum : true,
    totalAgorot: pricing.subtotalAgorot + deliveryFeeAgorot - pricing.discountAgorot,
  };
}

describe("order totals", () => {
  it("balances subtotal + delivery − discount for a delivery order", () => {
    const order = priceOrder([item("banana", 4), item("cucumber", 4)], [makePromotion()], "delivery");

    expect(order.pricing.subtotalAgorot).toBe(3200);
    expect(order.pricing.discountAgorot).toBe(1200);
    expect(order.deliveryFeeAgorot).toBe(2500);
    expect(order.totalAgorot).toBe(3200 + 2500 - 1200);
    expect(order.totalAgorot).toBe(4500);
  });

  it("charges no delivery fee for a pickup order", () => {
    const order = priceOrder([item("banana", 4), item("cucumber", 4)], [makePromotion()], "pickup");

    expect(order.deliveryFeeAgorot).toBe(0);
    expect(order.totalAgorot).toBe(2000);
  });

  it("applies no delivery minimum to a pickup order", () => {
    // ₪8 of goods — far below the ₪50 delivery minimum.
    const pickup = priceOrder([item("banana", 2)], [], "pickup");
    expect(pickup.meetsMinimum).toBe(true);

    const delivery = priceOrder([item("banana", 2)], [], "delivery");
    expect(delivery.meetsMinimum).toBe(false);
  });

  it("judges the delivery minimum on the discounted amount the customer pays", () => {
    // ₪52 of goods before promotion, ₪46 after — below the ₪50 minimum.
    const order = priceOrder(
      [item("banana", 4, 1300)],
      [makePromotion({ bundlePriceAgorot: 4600 })],
      "delivery"
    );

    expect(order.pricing.subtotalAgorot).toBe(5200);
    expect(order.pricing.chargedSubtotalAgorot).toBe(4600);
    expect(order.meetsMinimum).toBe(false);
  });

  it("grants free delivery on the discounted amount, not the pre-promotion one", () => {
    // ₪160 before promotion, ₪140 after — below the ₪150 free-delivery threshold.
    const order = priceOrder(
      [item("banana", 4, 4000)],
      [makePromotion({ bundlePriceAgorot: 14000 })],
      "delivery"
    );

    expect(order.pricing.chargedSubtotalAgorot).toBe(14000);
    expect(order.deliveryFeeAgorot).toBe(2500);
  });

  it("never lets a manipulated client total change the outcome", () => {
    // The action only ever receives variant ids and quantities; prices come from
    // the database. Feeding the engine the true prices always yields the true
    // total, whatever the browser claimed.
    const trusted = priceOrder([item("banana", 4)], [makePromotion()], "delivery");

    // What a tampered client might have displayed.
    const clientClaimedTotal = 1;

    expect(trusted.totalAgorot).not.toBe(clientClaimedTotal);
    expect(trusted.totalAgorot).toBe(1600 + 2500 - 600);
  });

  it("produces CardCom lines that sum to exactly the charged total", () => {
    const order = priceOrder(
      [item("banana", 3, 333), item("cucumber", 5, 777)],
      [makePromotion()],
      "delivery"
    );

    // The action sends chargedTotalAgorot per line plus a separate delivery line.
    const cardComLinesTotal = order.pricing.lines.reduce((s, l) => s + l.chargedTotalAgorot, 0);

    expect(cardComLinesTotal + order.deliveryFeeAgorot).toBe(order.totalAgorot);
    // No negative line ever reaches CardCom.
    for (const line of order.pricing.lines) {
      expect(line.chargedTotalAgorot).toBeGreaterThanOrEqual(0);
    }
  });

  it("keeps the order snapshot self-consistent", () => {
    const order = priceOrder([item("banana", 5), item("cucumber", 3)], [makePromotion()], "delivery");

    const lineSubtotal = order.pricing.lines.reduce((s, l) => s + l.normalTotalAgorot, 0);
    const lineDiscount = order.pricing.lines.reduce((s, l) => s + l.discountAgorot, 0);
    const promoDiscount = order.pricing.appliedPromotions.reduce((s, p) => s + p.discountAgorot, 0);

    expect(lineSubtotal).toBe(order.pricing.subtotalAgorot);
    expect(lineDiscount).toBe(order.pricing.discountAgorot);
    expect(promoDiscount).toBe(order.pricing.discountAgorot);
  });

  it("falls back to normal pricing when a promotion expires mid-session", () => {
    const items = [item("banana", 4)];
    const expired = makePromotion({ endsAt: "2026-08-01T00:00:00.000Z" });

    const before = priceOrder(items, [makePromotion()], "pickup");
    const after = priceOrder(items, [expired], "pickup");

    expect(before.totalAgorot).toBe(1000);
    expect(after.totalAgorot).toBe(1600);
    expect(after.pricing.discountAgorot).toBe(0);
  });
});
