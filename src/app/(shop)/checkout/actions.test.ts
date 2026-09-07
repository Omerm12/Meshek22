import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Behavioural coverage for createOrder(), focused on the cash-on-delivery bug
 * fix: cash orders must be created (order_status='confirmed',
 * payment_status='pending'), must never touch CardCom, must email once, must
 * be safe to resubmit, and the removed "phone_credit" payment method must be
 * rejected before it ever reaches the database. The online-card path is
 * covered too, to prove it is unchanged.
 *
 * Supabase, CardCom and email are stubbed; everything else (validation,
 * pricing, the RPC call shape, the branch logic) runs for real.
 */

const { dbRef, createCardComSession, sendOrderEmails } = vi.hoisted(() => ({
  dbRef: { current: null as unknown },
  createCardComSession: vi.fn(),
  sendOrderEmails: vi.fn(async () => {}),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => dbRef.current,
}));
vi.mock("@/lib/cardcom", () => ({ createCardComSession }));
vi.mock("@/lib/email/order-emails", () => ({ sendOrderEmails }));

import { createOrder } from "@/app/(shop)/checkout/actions";

// ─── Minimal Supabase stub ────────────────────────────────────────────────────

const VARIANT_ID = "0a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d";
const ZONE_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const IDEMPOTENCY_KEY = "9c858901-8a57-4791-81fe-4c455b099bc9";

function variantRow() {
  return {
    id: VARIANT_ID,
    price_agorot: 1000,
    is_available: true,
    label: "יחידה",
    quantity_pricing_mode: "fixed",
    products: {
      id: "product-1",
      name: "עגבניות",
      is_active: true,
      qty_deal_enabled: false,
      qty_deal_quantity: null,
      qty_deal_price_agorot: null,
    },
  };
}

interface DbOptions {
  rpc: { data: unknown; error: unknown };
  zone?: { id: string; name: string; delivery_fee_agorot: number; free_delivery_threshold_agorot: number | null; min_order_agorot: number | null } | null;
}

function makeDb(opts: DbOptions) {
  const rpcCalls: { name: string; params: Record<string, unknown> }[] = [];
  const updates: { table: string; patch: Record<string, unknown> }[] = [];

  const db = {
    rpcCalls,
    updates,
    from(table: string) {
      if (table === "product_variants") {
        return { select: () => ({ in: async () => ({ data: [variantRow()], error: null }) }) };
      }
      if (table === "promotions") {
        return { select: () => ({ eq: async () => ({ data: [], error: null }) }) };
      }
      if (table === "delivery_zones") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: opts.zone ?? null, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "orders") {
        return {
          update: (patch: Record<string, unknown>) => ({
            eq: async () => {
              updates.push({ table, patch });
              return { error: null };
            },
          }),
          select: () => ({
            eq: () => ({ single: async () => ({ data: null, error: null }) }),
          }),
        };
      }
      throw new Error(`unexpected table in test stub: ${table}`);
    },
    rpc: async (name: string, params: Record<string, unknown>) => {
      rpcCalls.push({ name, params });
      return opts.rpc;
    },
  };
  return db;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asDb = (db: ReturnType<typeof makeDb>) => db as any;

function pickupFormData(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("idempotency_key", overrides.idempotency_key ?? IDEMPOTENCY_KEY);
  fd.set("fulfillment_method", "pickup");
  fd.set("payment_method", overrides.payment_method ?? "cash");
  fd.set("cart_items", JSON.stringify([{ variantId: VARIANT_ID, quantity: 2 }]));
  fd.set("customer_name", "ישראל ישראלי");
  fd.set("customer_phone", "0501234567");
  fd.set("customer_email", "");
  fd.set("delivery_notes", "");
  return fd;
}

function deliveryFormData(overrides: Record<string, string> = {}) {
  const fd = pickupFormData(overrides);
  fd.set("fulfillment_method", "delivery");
  fd.set("delivery_zone_id", overrides.delivery_zone_id ?? ZONE_ID);
  fd.set("address_city", "רחובות");
  fd.set("address_street", "הרצל");
  fd.set("address_house_number", "12");
  fd.set("address_apartment", "");
  return fd;
}

function successfulRpc(overrides: Partial<{ out_order_id: string; out_order_number: string; out_is_duplicate: boolean }> = {}) {
  return {
    data: [
      {
        out_order_id: "order-1",
        out_order_number: "M22-0001",
        out_is_duplicate: false,
        ...overrides,
      },
    ],
    error: null,
  };
}

beforeEach(() => {
  createCardComSession.mockReset();
  sendOrderEmails.mockClear();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Cash on delivery ──────────────────────────────────────────────────────────

describe("cash-on-delivery order creation", () => {
  it("creates the order confirmed-and-pending, never touches CardCom, and returns the success URL", async () => {
    const db = makeDb({ rpc: successfulRpc() });
    dbRef.current = asDb(db);

    const result = await createOrder(pickupFormData({ payment_method: "cash" }));

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.orderNumber).toBe("M22-0001");
    expect(result.paymentUrl).toBeUndefined();
    expect(result.successUrl).toContain("/checkout/success?order=M22-0001");

    expect(db.rpcCalls).toHaveLength(1);
    expect(db.rpcCalls[0].params).toMatchObject({
      p_payment_method: "cash",
      p_order_status: "confirmed",
      p_payment_status: "pending",
    });

    expect(createCardComSession).not.toHaveBeenCalled();
  });

  it("reserves stock and creates the order through exactly one RPC call", async () => {
    const db = makeDb({ rpc: successfulRpc() });
    dbRef.current = asDb(db);

    await createOrder(pickupFormData({ payment_method: "cash" }));

    expect(db.rpcCalls.filter((c) => c.name === "create_guest_order_atomic")).toHaveLength(1);
  });

  it("sends order notifications exactly once", async () => {
    const db = makeDb({ rpc: successfulRpc() });
    dbRef.current = asDb(db);

    await createOrder(pickupFormData({ payment_method: "cash" }));

    expect(sendOrderEmails).toHaveBeenCalledTimes(1);
    expect(sendOrderEmails).toHaveBeenCalledWith("order-1", expect.anything());
  });

  it("works for delivery orders too, using the resolved delivery zone", async () => {
    const db = makeDb({
      rpc: successfulRpc(),
      zone: { id: ZONE_ID, name: "רחובות", delivery_fee_agorot: 2500, free_delivery_threshold_agorot: null, min_order_agorot: null },
    });
    dbRef.current = asDb(db);

    const result = await createOrder(deliveryFormData({ payment_method: "cash" }));

    expect("error" in result).toBe(false);
    expect(db.rpcCalls[0].params).toMatchObject({
      p_payment_method: "cash",
      p_order_status: "confirmed",
      p_delivery_fee_agorot: 2500,
    });
  });

  it("a resubmission with the same idempotency key resolves to the same order, not a second one", async () => {
    // The DB function (create_guest_order_atomic) is what actually enforces
    // this via the unique index on idempotency_key — see
    // src/lib/admin/transactional-integrity.test.ts for that guarantee. Here
    // we confirm the Server Action just surfaces a duplicate RPC response as
    // the same successful order, rather than treating it as a new one.
    const db = makeDb({ rpc: successfulRpc({ out_is_duplicate: false }) });
    dbRef.current = asDb(db);
    const fd1 = pickupFormData({ payment_method: "cash" });
    const first = await createOrder(fd1);

    db.rpc = async (name: string, params: Record<string, unknown>) => {
      db.rpcCalls.push({ name, params });
      return successfulRpc({ out_is_duplicate: true });
    };
    const fd2 = pickupFormData({ payment_method: "cash" });
    const second = await createOrder(fd2);

    expect("error" in first).toBe(false);
    expect("error" in second).toBe(false);
    if ("error" in first || "error" in second) return;
    expect(second.orderNumber).toBe(first.orderNumber);
  });

  it("delivery-zone-not-found is reported clearly for delivery orders (any payment method)", async () => {
    const db = makeDb({ rpc: successfulRpc(), zone: null });
    dbRef.current = asDb(db);

    const result = await createOrder(deliveryFormData({ payment_method: "cash" }));

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toContain("אזור המשלוח");
    expect(db.rpcCalls).toHaveLength(0);
  });
});

// ─── Removed payment method ────────────────────────────────────────────────────

describe("the removed phone_credit payment method is rejected for new orders", () => {
  it("never reaches the database", async () => {
    const db = makeDb({ rpc: successfulRpc() });
    dbRef.current = asDb(db);

    const result = await createOrder(pickupFormData({ payment_method: "phone_credit" }));

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toBe("אמצעי התשלום שנבחר אינו זמין יותר. נא לבחור אמצעי תשלום אחר ולנסות שוב.");
    expect(db.rpcCalls).toHaveLength(0);
    expect(createCardComSession).not.toHaveBeenCalled();
  });
});

// ─── Online credit card is unchanged ───────────────────────────────────────────

describe("credit-card checkout is unaffected", () => {
  it("stays pending_payment/pending, calls CardCom, and does not email at creation time", async () => {
    const db = makeDb({ rpc: successfulRpc() });
    dbRef.current = asDb(db);
    createCardComSession.mockResolvedValueOnce({
      lowProfileId: "lp-1",
      paymentUrl: "https://secure.cardcom.solutions/pay/lp-1",
    });

    const result = await createOrder(pickupFormData({ payment_method: "credit_card" }));

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.paymentUrl).toBe("https://secure.cardcom.solutions/pay/lp-1");

    expect(db.rpcCalls[0].params).toMatchObject({
      p_payment_method: "credit_card",
      p_order_status:   "pending_payment",
      p_payment_status: "pending",
    });
    expect(createCardComSession).toHaveBeenCalledTimes(1);
    expect(sendOrderEmails).not.toHaveBeenCalled();
  });
});

// ─── Errors: no internal detail leaked, but a reference id is given ───────────

describe("order-creation failure reporting", () => {
  it("keeps the specific out-of-stock message", async () => {
    const db = makeDb({
      rpc: { data: null, error: { code: "P0001", message: "insufficient stock for עגבניות", details: null, hint: null } },
    });
    dbRef.current = asDb(db);

    const result = await createOrder(pickupFormData({ payment_method: "cash" }));

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toContain("אזל מהמלאי");
  });

  it("returns a generic Hebrew message with a reference id, and logs the sanitized detail server-side", async () => {
    const db = makeDb({
      rpc: {
        data: null,
        error: {
          code: "23514",
          message: 'new row for relation "orders" violates check constraint "chk_confirmed_requires_paid"',
          details: "Failing row contains (...).",
          hint: null,
        },
      },
    });
    dbRef.current = asDb(db);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await createOrder(pickupFormData({ payment_method: "cash" }));

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;

    // Customer-facing message: no constraint name, no SQL, no internal code —
    // just a Hebrew apology and a short reference id to quote to support.
    expect(result.error).not.toContain("chk_confirmed_requires_paid");
    expect(result.error).not.toContain("23514");
    const refMatch = result.error.match(/מספר האסמכתא ([A-Z0-9]{8})/);
    expect(refMatch).not.toBeNull();
    const referenceId = refMatch![1];

    // Server-side log carries the full sanitized diagnostic plus that same
    // reference id, so support can correlate the customer's report with it.
    const loggedCall = errorSpy.mock.calls.find(
      (call) => call[0] === "[createOrder] create_guest_order_atomic failed"
    );
    expect(loggedCall).toBeDefined();
    const loggedPayload = loggedCall![1] as Record<string, unknown>;
    expect(loggedPayload.referenceId).toBe(referenceId);
    expect(loggedPayload.code).toBe("23514");
    expect(loggedPayload.message).toContain("chk_confirmed_requires_paid");
  });
});
