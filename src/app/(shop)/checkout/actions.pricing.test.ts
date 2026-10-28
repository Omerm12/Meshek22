import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cart total === checkout total === CardCom total, end to end through the real
 * createOrder and the real createCardComSession (only Supabase and `fetch` are
 * stubbed — no network, no real transaction).
 *
 * Regression for the reported order: parsley, 22 units at ₪4.50 with the
 * "4 for ₪10" deal = ₪59.00. CardCom priced that line as Quantity × a rounded
 * UnitCost (22 × 2.68 = ₪58.96) while charging ₪182.80, and the customer's stale
 * browser cart said ₪56.00 / ₪179.80.
 */

const { dbRef, sendOrderEmails } = vi.hoisted(() => ({
  dbRef: { current: null as unknown },
  sendOrderEmails: vi.fn(async () => {}),
}));

vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => dbRef.current }));
vi.mock("@/lib/email/order-emails", () => ({ sendOrderEmails }));

import { createOrder } from "@/app/(shop)/checkout/actions";

const ZONE_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const KEY = "9c858901-8a57-4791-81fe-4c455b099bc9";
const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

type Row = {
  name: string;
  price: number;
  vat: string;
  deal?: { qty: number; price: number };
  quantity: number;
};

const BASKET: Record<string, Row> = {
  [id(1)]: { name: "כוסברה", price: 1000, vat: "zero_rated", quantity: 1 },
  [id(2)]: { name: "שמיר", price: 1000, vat: "zero_rated", quantity: 1 },
  [id(3)]: { name: "פטרוזיליה", price: 450, vat: "zero_rated", quantity: 22, deal: { qty: 4, price: 1000 } },
  [id(4)]: { name: "אוכמניות", price: 3000, vat: "zero_rated", quantity: 1 },
  [id(5)]: { name: "מלפפון", price: 1780, vat: "zero_rated", quantity: 1 },
  [id(6)]: { name: "מוצר קוקוס", price: 3100, vat: "standard", quantity: 1 },
};
// 10 + 10 + (5×10 + 2×4.50 = 59) + 30 + 17.80 + 31 + 25 delivery
const SERVER_TOTAL = 1000 + 1000 + 5900 + 3000 + 1780 + 3100 + 2500;

function makeDb() {
  const rpcCalls: Record<string, unknown>[] = [];
  const variants = Object.entries(BASKET).map(([vid, r]) => ({
    id: vid,
    price_agorot: r.price,
    is_available: true,
    label: "יחידה",
    quantity_pricing_mode: "fixed",
    products: {
      id: `p-${vid}`,
      name: r.name,
      is_active: true,
      vat_class: r.vat,
      qty_deal_enabled: !!r.deal,
      qty_deal_quantity: r.deal?.qty ?? null,
      qty_deal_price_agorot: r.deal?.price ?? null,
    },
  }));
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
        return { update: () => ({ eq: async () => ({ error: null }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
    rpc: async (_n: string, params: Record<string, unknown>) => {
      rpcCalls.push(params);
      return {
        data: [{ out_order_id: "order-1", out_order_number: "M22-0001", out_is_duplicate: false }],
        error: null,
      };
    },
  };
}

function form(expectedTotal?: number) {
  const fd = new FormData();
  fd.set("idempotency_key", KEY);
  fd.set("fulfillment_method", "delivery");
  fd.set("payment_method", "credit_card");
  fd.set(
    "cart_items",
    JSON.stringify(Object.entries(BASKET).map(([variantId, r]) => ({ variantId, quantity: r.quantity })))
  );
  fd.set("customer_name", "ישראל ישראלי");
  fd.set("customer_phone", "0501234567");
  fd.set("customer_email", "israel@example.com");
  fd.set("delivery_notes", "");
  fd.set("delivery_zone_id", ZONE_ID);
  fd.set("address_city", "רחובות");
  fd.set("address_street", "הרצל");
  fd.set("address_house_number", "12");
  fd.set("address_apartment", "");
  if (expectedTotal !== undefined) fd.set("expected_total_agorot", String(expectedTotal));
  return fd;
}

const ENV = { ...process.env };
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.CARDCOM_TERMINAL_NUMBER = "1000";
  process.env.CARDCOM_API_NAME = "test-api";
  process.env.NEXT_PUBLIC_SITE_URL = "https://shop.example.com";
  fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ ResponseCode: 0, LowProfileId: "lp-1", Url: "https://pay.example/lp-1" }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  process.env = { ...ENV };
});

type Sent = {
  Amount: number;
  Document: {
    DocumentTypeToCreate: string;
    IsSendByEmail: boolean;
    Email: string;
    IsVatFree?: boolean;
    Products: { Description: string; Quantity: number; UnitCost: number; TotalLineCost: number; IsVatFree: boolean }[];
  };
};
const sent = (): Sent => JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
const agorot = (n: number) => Math.round(n * 100);

describe("reported order: cart = checkout = CardCom", () => {
  it("charges ₪182.80 and every CardCom line is exactly what CardCom will compute (Quantity × UnitCost)", async () => {
    const db = makeDb();
    dbRef.current = db;
    const result = await createOrder(form(SERVER_TOTAL));
    expect("error" in result).toBe(false);

    expect(db.rpcCalls[0].p_total_agorot).toBe(SERVER_TOTAL);
    const payload = sent();
    expect(payload.Amount).toBe(182.8);

    const cardcomSum = payload.Document.Products.reduce((s, p) => s + agorot(p.Quantity * p.UnitCost), 0);
    expect(cardcomSum).toBe(agorot(payload.Amount));
    for (const p of payload.Document.Products) {
      expect(agorot(p.Quantity * p.UnitCost)).toBe(agorot(p.TotalLineCost));
    }
  });

  it("keeps all 22 parsley units as exact rows: 20 × ₪2.50 + 2 × ₪4.50 (not 22 × ₪2.68 = ₪58.96)", async () => {
    dbRef.current = makeDb();
    await createOrder(form(SERVER_TOTAL));
    const parsley = sent().Document.Products.filter((p) => p.Description.includes("פטרוזיליה"));
    expect(parsley.map((p) => [p.Quantity, p.UnitCost, p.TotalLineCost])).toEqual([
      [20, 2.5, 50],
      [2, 4.5, 9],
    ]);
    expect(parsley.reduce((s, p) => s + p.Quantity, 0)).toBe(22);
    expect(parsley.every((p) => p.IsVatFree)).toBe(true);
  });

  it("keeps real quantities where the total divides evenly", async () => {
    dbRef.current = makeDb();
    await createOrder(form(SERVER_TOTAL));
    const cucumber = sent().Document.Products.find((p) => p.Description.includes("מלפפון"))!;
    expect([cucumber.Quantity, cucumber.UnitCost]).toEqual([1, 17.8]);
  });
});

describe("VAT sync Supabase → checkout → CardCom (mixed basket + delivery)", () => {
  it("flags each line per its stored class, delivery standard, never at document level", async () => {
    const db = makeDb();
    dbRef.current = db;
    await createOrder(form(SERVER_TOTAL));
    const payload = sent();

    const vatFree = Object.fromEntries(
      payload.Document.Products.map((p) => [p.Description.split(" — ")[0].split(" (")[0], p.IsVatFree])
    );
    expect(vatFree).toMatchObject({
      "כוסברה": true, "שמיר": true, "פטרוזיליה": true, "אוכמניות": true, "מלפפון": true,
      "מוצר קוקוס": false, "דמי משלוח": false,
    });
    expect(payload.Document.IsVatFree).toBeUndefined();

    const items = db.rpcCalls[0].p_items as { product_snapshot: { product_name: string; vat_class: string } }[];
    expect(items.find((i) => i.product_snapshot.product_name === "מוצר קוקוס")!.product_snapshot.vat_class).toBe("standard");
    expect(items.filter((i) => i.product_snapshot.vat_class === "zero_rated")).toHaveLength(5);
  });

  it("splits the charged total into zero-rated and VAT-bearing amounts without changing it", async () => {
    dbRef.current = makeDb();
    await createOrder(form(SERVER_TOTAL));
    const { Document, Amount } = sent();
    const zero = Document.Products.filter((p) => p.IsVatFree).reduce((s, p) => s + agorot(p.TotalLineCost), 0);
    const std = Document.Products.filter((p) => !p.IsVatFree).reduce((s, p) => s + agorot(p.TotalLineCost), 0);
    expect(zero).toBe(1000 + 1000 + 5900 + 3000 + 1780);
    expect(std).toBe(3100 + 2500);
    expect(zero + std).toBe(agorot(Amount));
    // Prices are VAT-inclusive: the 18% VAT contained in the taxable part.
    expect(Math.round((std * 18) / 118)).toBe(854);
  });
});

describe("invoice document settings", () => {
  it("requests a Tax Invoice/Receipt, emailed to the customer, in the same session that charges", async () => {
    dbRef.current = makeDb();
    await createOrder(form(SERVER_TOTAL));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const { Document } = sent();
    expect(Document.DocumentTypeToCreate).toBe("TaxInvoiceAndReceipt");
    expect(Document.IsSendByEmail).toBe(true);
    expect(Document.Email).toBe("israel@example.com");
  });
});

describe("confirmed total guard (stale browser cart)", () => {
  it("refuses a ₪179.80 confirmation when the database says ₪182.80 — no order, no CardCom session", async () => {
    const db = makeDb();
    dbRef.current = db;
    const result = await createOrder(form(17980));

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toContain("182.80");
    expect(result.priceChanged?.serverTotalAgorot).toBe(SERVER_TOTAL);
    const parsley = result.priceChanged!.items.find((i) => i.variantId === id(3))!;
    expect(parsley).toMatchObject({ priceAgorot: 450, dealEnabled: true, dealQuantity: 4, dealPriceAgorot: 1000 });
    expect(db.rpcCalls).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["missing (cached old frontend)", undefined],
    ["not a number", "abc"],
    ["fractional", "18280.5"],
    ["negative", "-18280"],
    ["empty", ""],
  ])("fails closed when the displayed total is %s — nothing is created", async (_label, raw) => {
    const db = makeDb();
    dbRef.current = db;
    const fd = form();
    if (raw !== undefined) fd.set("expected_total_agorot", raw);
    const result = await createOrder(fd);

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    // The customer gets the authoritative figures to review and confirm.
    expect(result.priceChanged?.serverTotalAgorot).toBe(SERVER_TOTAL);
    expect(result.priceChanged?.items).toHaveLength(Object.keys(BASKET).length);
    expect(Array.isArray(result.priceChanged?.promotions)).toBe(true);
    expect(db.rpcCalls).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a cash order is guarded the same way", async () => {
    const db = makeDb();
    dbRef.current = db;
    const fd = form();
    fd.set("payment_method", "cash");
    const result = await createOrder(fd);
    expect("error" in result).toBe(true);
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("proceeds when the confirmed total matches exactly", async () => {
    dbRef.current = makeDb();
    const result = await createOrder(form(SERVER_TOTAL));
    expect("error" in result).toBe(false);
  });
});
