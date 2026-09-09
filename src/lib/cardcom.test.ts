import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calculateCartPricing } from "@/lib/promotions/engine";
import type { PricedItem, Promotion } from "@/lib/promotions/types";
import { createCardComSession, type CardComLineItem } from "@/lib/cardcom";

/**
 * Regression coverage for the CardCom low-profile payload, specifically the
 * bug where a cart with a quantity promotion (4-for-X, 3-for-X, …) failed to
 * reach CardCom at all.
 *
 * Root cause: UnitCost was always the undiscounted catalog price while
 * TotalLineCost was already the promotion-discounted line total, so
 * Quantity × UnitCost ≠ TotalLineCost for any discounted line — two numbers
 * on the same row disagreeing about its price, which CardCom rejects the
 * whole document for. There was never a separate "הנחת מבצעים" discount row;
 * the mismatch was entirely inside the discounted product row itself.
 *
 * Fix: UnitCost is now derived FROM TotalLineCost (TotalLineCost / Quantity),
 * so the two always agree, and a belt-and-braces integer-agorot check throws
 * before ever calling CardCom if a caller's line items don't sum with the
 * delivery fee to the exact order total.
 */

const ORIGINAL_ENV = { ...process.env };

function stubEnv() {
  process.env.CARDCOM_TERMINAL_NUMBER = "189307";
  process.env.CARDCOM_API_NAME = "test-api-name";
  process.env.NEXT_PUBLIC_SITE_URL = "https://meshek22.example.com";
}

let fetchMock: ReturnType<typeof vi.fn>;

function mockCardComSuccess() {
  fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({
        ResponseCode: 0,
        LowProfileId: "lp-test-1",
        Url: "https://secure.cardcom.solutions/pay/lp-test-1",
      }),
  }));
  vi.stubGlobal("fetch", fetchMock);
}

/** The exact JSON body createCardComSession sent to CardCom on its one fetch call. */
function sentPayload(): {
  Amount: number;
  Document: { Products: Array<{ Description: string; Quantity: number; UnitCost: number; TotalLineCost: number }> };
} {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [, init] = fetchMock.mock.calls[0];
  return JSON.parse((init as RequestInit).body as string);
}

/** Sum of every Document.Products[].TotalLineCost, back in integer agorot. */
function productsSumAgorot(payload: ReturnType<typeof sentPayload>): number {
  return Math.round(
    payload.Document.Products.reduce((sum, p) => sum + p.TotalLineCost, 0) * 100
  );
}

beforeEach(() => {
  stubEnv();
  mockCardComSuccess();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

function baseArgs(overrides: Partial<Parameters<typeof createCardComSession>[0]> = {}) {
  return {
    orderId: "order-1",
    orderNumber: "M22-0001",
    totalAgorot: 0,
    customerName: "ישראל ישראלי",
    customerEmail: "israel@example.com",
    customerPhone: "0501234567",
    lineItems: [] as CardComLineItem[],
    deliveryFeeAgorot: 0,
    ...overrides,
  };
}

/** variantId → product/variant metadata, for turning pricing.lines into CardComLineItem[]. */
function toCardComLineItems(
  lines: ReturnType<typeof calculateCartPricing>["lines"],
  descriptions: Record<string, string>
): CardComLineItem[] {
  return lines.map((line) => ({
    productId: line.variantId,
    description: descriptions[line.variantId] ?? line.variantId,
    quantity: line.quantity,
    unitPriceAgorot: line.unitPriceAgorot,
    totalPriceAgorot: line.chargedTotalAgorot,
  }));
}

function promotion(overrides: Partial<Promotion> & Pick<Promotion, "id" | "requiredQuantity" | "bundlePriceAgorot" | "eligibleVariantIds">): Promotion {
  return {
    name: overrides.id,
    description: null,
    promotionType: "mix_and_match_quantity",
    isActive: true,
    startsAt: null,
    endsAt: null,
    sortOrder: 0,
    ...overrides,
  };
}

// ─── 1. Order without promotions ───────────────────────────────────────────────

describe("order without promotions", () => {
  it("sends each line at its normal catalog price, with UnitCost × Quantity === TotalLineCost", async () => {
    const items: PricedItem[] = [
      { variantId: "v1", productId: "p1", quantity: 2, priceAgorot: 1500, quantityPricingMode: "fixed" },
    ];
    const pricing = calculateCartPricing(items, []);
    expect(pricing.discountAgorot).toBe(0);

    const lineItems = toCardComLineItems(pricing.lines, { v1: "עגבניות — יחידה" });

    await createCardComSession(
      baseArgs({ totalAgorot: pricing.chargedSubtotalAgorot, lineItems })
    );

    const payload = sentPayload();
    expect(payload.Document.Products).toHaveLength(1);
    const [line] = payload.Document.Products;
    expect(line.UnitCost).toBe(15);
    expect(line.TotalLineCost).toBe(30);
    expect(Math.round(line.UnitCost * line.Quantity * 100)).toBe(Math.round(line.TotalLineCost * 100));
    expect(payload.Amount).toBe(30);
  });
});

// ─── 2 & 3. Quantity promotions (4-for-X, 3-for-X) ─────────────────────────────

describe("4-for-X quantity promotion", () => {
  it("bakes the discount into the product line, with no separate discount row", async () => {
    // 4 units @ 10.00 ₪ normally = 40.00 ₪; the deal charges 30.00 ₪ for 4.
    const items: PricedItem[] = [
      { variantId: "v1", productId: "p1", quantity: 4, priceAgorot: 1000, quantityPricingMode: "fixed" },
    ];
    const promotions: Promotion[] = [
      promotion({ id: "promo-4", requiredQuantity: 4, bundlePriceAgorot: 3000, eligibleVariantIds: ["v1"] }),
    ];
    const pricing = calculateCartPricing(items, promotions);
    expect(pricing.discountAgorot).toBe(1000); // 40.00 - 30.00 = 10.00 ₪ = 1000 agorot

    const lineItems = toCardComLineItems(pricing.lines, { v1: "מוצר — יחידה" });
    await createCardComSession(
      baseArgs({ totalAgorot: pricing.chargedSubtotalAgorot, lineItems })
    );

    const payload = sentPayload();
    expect(payload.Document.Products).toHaveLength(1); // no extra discount line
    const [line] = payload.Document.Products;
    expect(line.TotalLineCost).toBe(30); // 3000 agorot, the discounted total
    expect(line.UnitCost).toBeCloseTo(7.5, 2); // derived FROM the discounted total
    expect(Math.round(line.UnitCost * line.Quantity * 100)).toBe(Math.round(line.TotalLineCost * 100));
    expect(payload.Amount).toBe(30);
  });
});

describe("3-for-X quantity promotion", () => {
  it("bakes the discount into the product line, with no separate discount row", async () => {
    // 3 units @ 15.00 ₪ normally = 45.00 ₪; the deal charges 36.00 ₪ for 3.
    const items: PricedItem[] = [
      { variantId: "v2", productId: "p2", quantity: 3, priceAgorot: 1500, quantityPricingMode: "fixed" },
    ];
    const promotions: Promotion[] = [
      promotion({ id: "promo-3", requiredQuantity: 3, bundlePriceAgorot: 3600, eligibleVariantIds: ["v2"] }),
    ];
    const pricing = calculateCartPricing(items, promotions);
    expect(pricing.discountAgorot).toBe(900); // 45.00 - 36.00 = 9.00 ₪ = 900 agorot

    const lineItems = toCardComLineItems(pricing.lines, { v2: "מוצר אחר — יחידה" });
    await createCardComSession(
      baseArgs({ totalAgorot: pricing.chargedSubtotalAgorot, lineItems })
    );

    const payload = sentPayload();
    expect(payload.Document.Products).toHaveLength(1);
    const [line] = payload.Document.Products;
    expect(line.TotalLineCost).toBe(36);
    expect(Math.round(line.UnitCost * line.Quantity * 100)).toBe(Math.round(line.TotalLineCost * 100));
    expect(payload.Amount).toBe(36);
  });
});

// ─── 4. Multiple quantity promotions in the same cart ──────────────────────────

describe("multiple quantity promotions in the same cart", () => {
  it("discounts each line independently, still with no discount row, and the totals still balance", async () => {
    const items: PricedItem[] = [
      { variantId: "v1", productId: "p1", quantity: 4, priceAgorot: 1000, quantityPricingMode: "fixed" }, // 4-for-30
      { variantId: "v2", productId: "p2", quantity: 3, priceAgorot: 1500, quantityPricingMode: "fixed" }, // 3-for-36
      { variantId: "v3", productId: "p3", quantity: 1, priceAgorot: 800, quantityPricingMode: "fixed" }, // no promo
    ];
    const promotions: Promotion[] = [
      promotion({ id: "promo-4", requiredQuantity: 4, bundlePriceAgorot: 3000, eligibleVariantIds: ["v1"] }),
      promotion({ id: "promo-3", requiredQuantity: 3, bundlePriceAgorot: 3600, eligibleVariantIds: ["v2"] }),
    ];
    const pricing = calculateCartPricing(items, promotions);
    expect(pricing.discountAgorot).toBe(1900); // 1000 + 900
    expect(pricing.appliedPromotions).toHaveLength(2);

    const lineItems = toCardComLineItems(pricing.lines, {
      v1: "מוצר א׳ — יחידה",
      v2: "מוצר ב׳ — יחידה",
      v3: "מוצר ג׳ — יחידה",
    });
    await createCardComSession(
      baseArgs({ totalAgorot: pricing.chargedSubtotalAgorot, lineItems })
    );

    const payload = sentPayload();
    expect(payload.Document.Products).toHaveLength(3);
    for (const line of payload.Document.Products) {
      expect(Math.round(line.UnitCost * line.Quantity * 100)).toBe(Math.round(line.TotalLineCost * 100));
    }
    expect(productsSumAgorot(payload)).toBe(pricing.chargedSubtotalAgorot);
    expect(payload.Amount).toBe(pricing.chargedSubtotalAgorot / 100);
  });
});

// ─── 5. Quantity promotion plus delivery fee (the reported bug) ───────────────

describe("quantity promotion plus delivery fee", () => {
  it("matches the reported real-world numbers exactly: 339.38 ₪ product lines + 25.00 ₪ delivery = 364.38 ₪", async () => {
    // Directly reproduces the checkout summary from the bug report:
    // subtotal 341.38, discount -2.00, delivery 25.00, total 364.38 — i.e. the
    // product lines sent to CardCom must total 339.38, not 341.38.
    const lineItems: CardComLineItem[] = [
      { productId: "v1", description: "מוצר עם מבצע — יחידה", quantity: 4, unitPriceAgorot: 8534, totalPriceAgorot: 33938 },
    ];
    await createCardComSession(
      baseArgs({ totalAgorot: 36438, deliveryFeeAgorot: 2500, lineItems })
    );

    const payload = sentPayload();
    // No separate discount line: exactly one product line plus one delivery line.
    expect(payload.Document.Products).toHaveLength(2);

    const [productLine, deliveryLine] = payload.Document.Products;
    expect(productLine.TotalLineCost).toBe(339.38);
    expect(deliveryLine.Description).toBe("דמי משלוח");
    expect(deliveryLine.TotalLineCost).toBe(25);
    expect(deliveryLine.UnitCost).toBe(25);

    expect(payload.Amount).toBe(364.38);
    expect(productsSumAgorot(payload)).toBe(36438);
  });

  it("still balances with several discounted lines plus delivery", async () => {
    const items: PricedItem[] = [
      { variantId: "v1", productId: "p1", quantity: 4, priceAgorot: 1000, quantityPricingMode: "fixed" },
      { variantId: "v2", productId: "p2", quantity: 3, priceAgorot: 1500, quantityPricingMode: "fixed" },
    ];
    const promotions: Promotion[] = [
      promotion({ id: "promo-4", requiredQuantity: 4, bundlePriceAgorot: 3000, eligibleVariantIds: ["v1"] }),
      promotion({ id: "promo-3", requiredQuantity: 3, bundlePriceAgorot: 3600, eligibleVariantIds: ["v2"] }),
    ];
    const pricing = calculateCartPricing(items, promotions);
    const deliveryFeeAgorot = 2500;
    const totalAgorot = pricing.chargedSubtotalAgorot + deliveryFeeAgorot;

    const lineItems = toCardComLineItems(pricing.lines, { v1: "מוצר א׳", v2: "מוצר ב׳" });
    await createCardComSession(baseArgs({ totalAgorot, deliveryFeeAgorot, lineItems }));

    const payload = sentPayload();
    expect(productsSumAgorot(payload)).toBe(totalAgorot);
    expect(payload.Amount).toBe(totalAgorot / 100);
  });
});

// ─── 6. Decimal / fractional quantities ────────────────────────────────────────

describe("decimal/fractional quantities", () => {
  it("keeps UnitCost and TotalLineCost consistent for a per-kg line (never eligible for a quantity promotion)", async () => {
    const items: PricedItem[] = [
      { variantId: "v1", productId: "p1", quantity: 0.734, priceAgorot: 2000, quantityPricingMode: "per_kg" },
    ];
    // Even with a promotion configured, per_kg lines are excluded by the engine.
    const promotions: Promotion[] = [
      promotion({ id: "promo-4", requiredQuantity: 4, bundlePriceAgorot: 3000, eligibleVariantIds: ["v1"] }),
    ];
    const pricing = calculateCartPricing(items, promotions);
    expect(pricing.discountAgorot).toBe(0);
    expect(pricing.lines[0].normalTotalAgorot).toBe(1468); // round(2000 * 0.734)

    const lineItems = toCardComLineItems(pricing.lines, { v1: "ירק לפי משקל — ק״ג" });
    await createCardComSession(baseArgs({ totalAgorot: pricing.chargedSubtotalAgorot, lineItems }));

    const payload = sentPayload();
    const [line] = payload.Document.Products;
    expect(line.TotalLineCost).toBe(14.68);
    expect(line.Quantity).toBe(0.734);
    // UnitCost × Quantity may differ from TotalLineCost by at most a rounding
    // cent — TotalLineCost (not UnitCost × Quantity) is what must be exact.
    expect(Math.abs(line.UnitCost * line.Quantity - line.TotalLineCost)).toBeLessThan(0.01);
    expect(payload.Amount).toBe(14.68);
  });
});

// ─── 7 & 8. Payload invariants ──────────────────────────────────────────────────

describe("CardCom payload invariants", () => {
  it("never contains a negative TotalLineCost or a standalone discount/promotion line", async () => {
    const items: PricedItem[] = [
      { variantId: "v1", productId: "p1", quantity: 4, priceAgorot: 1000, quantityPricingMode: "fixed" },
    ];
    const promotions: Promotion[] = [
      promotion({ id: "promo-4", requiredQuantity: 4, bundlePriceAgorot: 3000, eligibleVariantIds: ["v1"] }),
    ];
    const pricing = calculateCartPricing(items, promotions);
    const lineItems = toCardComLineItems(pricing.lines, { v1: "מוצר" });

    await createCardComSession(
      baseArgs({ totalAgorot: pricing.chargedSubtotalAgorot + 2500, deliveryFeeAgorot: 2500, lineItems })
    );

    const payload = sentPayload();
    for (const line of payload.Document.Products) {
      expect(line.TotalLineCost).toBeGreaterThanOrEqual(0);
      expect(line.UnitCost).toBeGreaterThanOrEqual(0);
      expect(line.Description).not.toMatch(/הנחת מבצע|הנחה|discount/i);
    }
    // Exactly one line per cart line plus one delivery line — never an extra row.
    expect(payload.Document.Products).toHaveLength(lineItems.length + 1);
  });

  it("rejects (throws, never calls CardCom) if the line items don't sum with delivery to the order total", async () => {
    const lineItems: CardComLineItem[] = [
      { productId: "v1", description: "מוצר", quantity: 1, unitPriceAgorot: 1000, totalPriceAgorot: 1000 },
    ];
    await expect(
      createCardComSession(baseArgs({ totalAgorot: 9999, deliveryFeeAgorot: 0, lineItems }))
    ).rejects.toThrow(/do not sum to the order total/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("the product-lines sum plus delivery always equals the CardCom Amount, in every scenario above", async () => {
    const items: PricedItem[] = [
      { variantId: "v1", productId: "p1", quantity: 4, priceAgorot: 1000, quantityPricingMode: "fixed" },
      { variantId: "v2", productId: "p2", quantity: 3, priceAgorot: 1500, quantityPricingMode: "fixed" },
      { variantId: "v3", productId: "p3", quantity: 0.5, priceAgorot: 4000, quantityPricingMode: "per_kg" },
    ];
    const promotions: Promotion[] = [
      promotion({ id: "promo-4", requiredQuantity: 4, bundlePriceAgorot: 3000, eligibleVariantIds: ["v1"] }),
      promotion({ id: "promo-3", requiredQuantity: 3, bundlePriceAgorot: 3600, eligibleVariantIds: ["v2"] }),
    ];
    const pricing = calculateCartPricing(items, promotions);
    const deliveryFeeAgorot = 1990;
    const totalAgorot = pricing.chargedSubtotalAgorot + deliveryFeeAgorot;

    const lineItems = toCardComLineItems(pricing.lines, { v1: "א", v2: "ב", v3: "ג" });
    await createCardComSession(baseArgs({ totalAgorot, deliveryFeeAgorot, lineItems }));

    const payload = sentPayload();
    expect(productsSumAgorot(payload)).toBe(totalAgorot);
    expect(Math.round(payload.Amount * 100)).toBe(totalAgorot);
  });
});
