import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * VAT handling in checkout: createOrder freezes each product's server-side VAT
 * class into the order item snapshot and forwards it to CardCom; retryPayment
 * rebuilds the CardCom lines from that stored snapshot only — it never reads the
 * products table, so a product edited after the order cannot change the order's
 * tax treatment. A retry of an order from before VAT classification (no
 * snapshot) is refused and flagged for review — it never issues a document on a
 * guessed tax class.
 *
 * Supabase, CardCom and email are stubbed. No network, no real transaction.
 */

const { dbRef, createCardComSession, sendOrderEmails } = vi.hoisted(() => ({
  dbRef: { current: null as unknown },
  createCardComSession: vi.fn(),
  sendOrderEmails: vi.fn(async () => {}),
}));

vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => dbRef.current }));
vi.mock("@/lib/cardcom", () => ({ createCardComSession }));
vi.mock("@/lib/email/order-emails", () => ({ sendOrderEmails }));

import { createOrder, retryPayment } from "@/app/(shop)/checkout/actions";
import { createGuestAccessToken, hashGuestAccessToken } from "@/lib/checkout/guest-token";

const FRUIT_VARIANT = "0a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d";
const SNACK_VARIANT = "1b2c3d4e-5f6a-4b7c-8d9e-1f2a3b4c5d6e";
const ZONE_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const IDEMPOTENCY_KEY = "9c858901-8a57-4791-81fe-4c455b099bc9";

function variant(id: string, name: string, price: number, vat: string) {
  return {
    id,
    price_agorot: price,
    is_available: true,
    label: "יחידה",
    quantity_pricing_mode: "fixed",
    products: {
      id: `product-${id.slice(0, 4)}`,
      name,
      is_active: true,
      qty_deal_enabled: false,
      qty_deal_quantity: null,
      qty_deal_price_agorot: null,
      vat_class: vat,
    },
  };
}

function makeCreateDb(variants: ReturnType<typeof variant>[]) {
  const rpcCalls: { params: Record<string, unknown> }[] = [];
  return {
    rpcCalls,
    from(table: string) {
      if (table === "product_variants") {
        return { select: () => ({ in: async () => ({ data: variants, error: null }) }) };
      }
      if (table === "promotions") {
        return { select: () => ({ eq: async () => ({ data: [], error: null }) }) };
      }
      if (table === "delivery_zones") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: ZONE_ID, name: "רחובות", delivery_fee_agorot: 2500,
                    free_delivery_threshold_agorot: null, min_order_agorot: null,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === "orders") {
        return {
          update: () => ({ eq: async () => ({ error: null }) }),
          select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
    rpc: async (_name: string, params: Record<string, unknown>) => {
      rpcCalls.push({ params });
      return {
        data: [{ out_order_id: "order-1", out_order_number: "M22-0001", out_is_duplicate: false }],
        error: null,
      };
    },
  };
}

function cardForm(cart: { variantId: string; quantity: number }[], delivery = false, expectedTotal?: number) {
  const fd = new FormData();
  if (expectedTotal !== undefined) fd.set("expected_total_agorot", String(expectedTotal));
  fd.set("idempotency_key", IDEMPOTENCY_KEY);
  fd.set("fulfillment_method", delivery ? "delivery" : "pickup");
  fd.set("payment_method", "credit_card");
  fd.set("cart_items", JSON.stringify(cart));
  fd.set("customer_name", "ישראל ישראלי");
  fd.set("customer_phone", "0501234567");
  fd.set("customer_email", "israel@example.com");
  fd.set("delivery_notes", "");
  if (delivery) {
    fd.set("delivery_zone_id", ZONE_ID);
    fd.set("address_city", "רחובות");
    fd.set("address_street", "הרצל");
    fd.set("address_house_number", "12");
    fd.set("address_apartment", "");
  }
  return fd;
}

beforeEach(() => {
  createCardComSession.mockReset();
  createCardComSession.mockResolvedValue({ lowProfileId: "lp-1", paymentUrl: "https://pay.example/lp-1" });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe("createOrder — VAT class capture", () => {
  it("freezes each server-side class into the item snapshot and forwards it to CardCom (mixed basket + delivery)", async () => {
    const db = makeCreateDb([
      variant(FRUIT_VARIANT, "תפוחים", 1000, "zero_rated"),
      variant(SNACK_VARIANT, "חטיף", 1500, "standard"),
    ]);
    dbRef.current = db;

    const result = await createOrder(
      cardForm([{ variantId: FRUIT_VARIANT, quantity: 2 }, { variantId: SNACK_VARIANT, quantity: 1 }], true, 6000)
    );
    expect("error" in result).toBe(false);

    const items = db.rpcCalls[0].params.p_items as { product_variant_id: string; product_snapshot: { vat_class: string } }[];
    const byVariant = Object.fromEntries(items.map((i) => [i.product_variant_id, i.product_snapshot.vat_class]));
    expect(byVariant).toEqual({ [FRUIT_VARIANT]: "zero_rated", [SNACK_VARIANT]: "standard" });

    // Amounts are unchanged by VAT class: 2×10 + 15 + 25 delivery.
    expect(db.rpcCalls[0].params.p_total_agorot).toBe(2000 + 1500 + 2500);

    const call = createCardComSession.mock.calls[0][0];
    expect(call.totalAgorot).toBe(6000);
    expect(call.deliveryFeeAgorot).toBe(2500);
    const vatByVariant = Object.fromEntries(
      call.lineItems.map((l: { productId: string; vatClass: string }) => [l.productId, l.vatClass])
    );
    expect(vatByVariant).toEqual({ [FRUIT_VARIANT]: "zero_rated", [SNACK_VARIANT]: "standard" });
  });

  it("fails closed, before any order exists, on an unrecognised class", async () => {
    const db = makeCreateDb([variant(FRUIT_VARIANT, "תפוחים", 1000, "bogus")]);
    dbRef.current = db;

    const result = await createOrder(cardForm([{ variantId: FRUIT_VARIANT, quantity: 1 }]));

    expect("error" in result).toBe(true);
    expect(db.rpcCalls).toHaveLength(0);
    expect(createCardComSession).not.toHaveBeenCalled();
  });
});

// ─── retryPayment ──────────────────────────────────────────────────────────────

function makeRetryDb(snapshots: Record<string, unknown>[], tablesTouched: string[]) {
  const token = createGuestAccessToken();
  const items = snapshots.map((snap, i) => ({
    product_variant_id: `variant-${i}`,
    product_snapshot: snap,
    quantity: 1,
    unit_price_agorot: 1000,
    total_price_agorot: 1000,
    discount_agorot: 0,
  }));
  const db = {
    from(table: string) {
      tablesTouched.push(table);
      if (table === "orders") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: "order-9", order_number: "M22-0009", payment_status: "pending",
                    payment_method: "credit_card", total_agorot: items.length * 1000 + 2500,
                    delivery_fee_agorot: 2500,
                    customer_snapshot: { name: "ישראל", email: "i@example.com", phone: "0501234567" },
                  },
                  error: null,
                }),
              }),
            }),
          }),
          update: () => ({ eq: () => ({ eq: async () => ({ error: null }), then: undefined }) }),
        };
      }
      if (table === "order_items") {
        return { select: () => ({ eq: async () => ({ data: items, error: null }) }) };
      }
      throw new Error(`retryPayment must not read ${table}`);
    },
  };
  return { db, token };
}

describe("retryPayment — original order snapshot only", () => {
  it("uses the stored VAT classes and never reads the products/variants tables", async () => {
    const touched: string[] = [];
    const { db, token } = makeRetryDb(
      [
        { product_name: "תפוחים", variant_label: "יחידה", vat_class: "zero_rated" },
        { product_name: "חטיף", variant_label: "יחידה", vat_class: "standard" },
      ],
      touched
    );
    dbRef.current = db;
    // The token hash only needs to reach the stub's eq() chain.
    void hashGuestAccessToken(token);

    const result = await retryPayment("order-9", token);

    expect("error" in result).toBe(false);
    const call = createCardComSession.mock.calls[0][0];
    expect(call.lineItems.map((l: { vatClass: string }) => l.vatClass)).toEqual(["zero_rated", "standard"]);
    expect(call.totalAgorot).toBe(4500);
    expect(new Set(touched)).toEqual(new Set(["orders", "order_items"]));
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("legacy order without a snapshot class: retry is refused, flagged for review, CardCom never called", async () => {
    const touched: string[] = [];
    const { db, token } = makeRetryDb(
      [
        { product_name: "תפוחים", variant_label: "יחידה", vat_class: "zero_rated" },
        { product_name: "חטיף", variant_label: "יחידה" },
      ],
      touched
    );
    dbRef.current = db;

    const result = await retryPayment("order-9", token);

    expect("error" in result).toBe(true);
    expect(createCardComSession).not.toHaveBeenCalled();
    expect(touched).not.toContain("products");
    expect(touched).not.toContain("product_variants");
    expect(console.warn).toHaveBeenCalledWith(
      "[retryPayment]",
      expect.objectContaining({
        event: "legacy_order_vat_unknown_retry_blocked",
        orderId: "order-9",
        legacyItems: 1,
        totalItems: 2,
      })
    );
  });
});
