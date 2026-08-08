import { describe, expect, it } from "vitest";
import {
  CART_VERSION,
  deserializeCart,
  parseStoredCartItem,
  serializeCart,
  type StoredCartItem,
} from "@/lib/cart/storage";

function makeItem(overrides: Partial<StoredCartItem> = {}): StoredCartItem {
  return {
    variantId:           "variant-1",
    productId:           "product-1",
    productName:         "בננה",
    variantLabel:        "יחידה",
    priceAgorot:         400,
    quantity:            2,
    imageUrl:            null,
    quantityPricingMode: "fixed",
    quantityStep:        1,
    minQuantity:         1,
    dealEnabled:         false,
    dealQuantity:        null,
    dealPriceAgorot:     null,
    ...overrides,
  };
}

describe("guest cart persistence", () => {
  it("survives a round trip, which is what a page refresh does", () => {
    const items = [makeItem(), makeItem({ variantId: "variant-2", quantity: 3 })];
    const restored = deserializeCart(serializeCart(items));

    expect(restored).toHaveLength(2);
    expect(restored[0].variantId).toBe("variant-1");
    expect(restored[0].quantity).toBe(2);
    expect(restored[1].quantity).toBe(3);
  });

  it("keeps fractional per_kg quantities intact", () => {
    const item = makeItem({
      quantityPricingMode: "per_kg",
      quantity: 1.5,
      quantityStep: 0.5,
      minQuantity: 0.5,
    });
    const [restored] = deserializeCart(serializeCart([item]));

    expect(restored.quantity).toBe(1.5);
    expect(restored.quantityStep).toBe(0.5);
    expect(restored.quantityPricingMode).toBe("per_kg");
  });

  it("preserves legacy deal fields", () => {
    const item = makeItem({ dealEnabled: true, dealQuantity: 4, dealPriceAgorot: 1000 });
    const [restored] = deserializeCart(serializeCart([item]));

    expect(restored.dealEnabled).toBe(true);
    expect(restored.dealQuantity).toBe(4);
    expect(restored.dealPriceAgorot).toBe(1000);
  });

  it("returns an empty cart for missing storage", () => {
    expect(deserializeCart(null)).toEqual([]);
    expect(deserializeCart("")).toEqual([]);
  });

  it("returns an empty cart for malformed JSON instead of throwing", () => {
    expect(() => deserializeCart("{not json")).not.toThrow();
    expect(deserializeCart("{not json")).toEqual([]);
    expect(deserializeCart("null")).toEqual([]);
    expect(deserializeCart("[1,2,3]")).toEqual([]);
  });

  it("discards a cart written by an older version", () => {
    const stale = JSON.stringify({ version: CART_VERSION - 1, items: [makeItem()] });
    expect(deserializeCart(stale)).toEqual([]);
  });

  it("drops individual malformed entries but keeps the valid ones", () => {
    const mixed = JSON.stringify({
      version: CART_VERSION,
      items: [
        makeItem(),
        { variantId: "" },
        null,
        "not an object",
        { ...makeItem({ variantId: "variant-3" }), quantity: -5 },
        { ...makeItem({ variantId: "variant-4" }), priceAgorot: Number.NaN },
        makeItem({ variantId: "variant-5" }),
      ],
    });

    const restored = deserializeCart(mixed);
    expect(restored.map((i) => i.variantId)).toEqual(["variant-1", "variant-5"]);
  });

  it("rejects an absurd quantity", () => {
    expect(parseStoredCartItem(makeItem({ quantity: 100_000 }))).toBeNull();
    expect(parseStoredCartItem(makeItem({ quantity: 0 }))).toBeNull();
  });

  it("falls back to safe defaults for missing optional fields", () => {
    const partial = {
      variantId: "v",
      productId: "p",
      productName: "מוצר",
      variantLabel: "יחידה",
      priceAgorot: 100,
      quantity: 1,
    };
    const parsed = parseStoredCartItem(partial);

    expect(parsed).not.toBeNull();
    expect(parsed!.quantityPricingMode).toBe("fixed");
    expect(parsed!.quantityStep).toBe(1);
    expect(parsed!.minQuantity).toBe(1);
    expect(parsed!.dealEnabled).toBe(false);
  });

  it("caps the number of restored lines", () => {
    const many = Array.from({ length: 500 }, (_, i) => makeItem({ variantId: `v${i}` }));
    expect(deserializeCart(serializeCart(many))).toHaveLength(200);
  });
});
