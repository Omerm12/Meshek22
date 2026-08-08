import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Email behaviour around order acceptance.
 *
 * The Resend service is stubbed so nothing is sent; these tests are about WHICH
 * message goes out, WHEN, and HOW MANY times — the parts that decide whether the
 * shop finds out about an order, and whether a customer is emailed twice.
 */
const { sendCustomer, sendAdmin } = vi.hoisted(() => ({
  sendCustomer: vi.fn(async () => ({ ok: true as const })),
  sendAdmin: vi.fn(async () => ({ ok: true as const })),
}));

vi.mock("@/lib/email/service", () => ({
  sendCustomerOrderConfirmation: sendCustomer,
  sendAdminNewOrderNotification: sendAdmin,
}));

import { sendOrderEmails } from "@/lib/email/order-emails";

// ─── Minimal Supabase stub ────────────────────────────────────────────────────

interface StubOrder {
  id: string;
  order_number: string;
  created_at: string;
  customer_snapshot: unknown;
  delivery_address_snapshot: unknown;
  subtotal_agorot: number;
  delivery_fee_agorot: number;
  discount_agorot: number;
  total_agorot: number;
  fulfillment_method?: string | null;
  payment_method: string | null;
  order_status: string;
  customer_email_sent_at: string | null;
  admin_email_sent_at: string | null;
}

function makeOrder(overrides: Partial<StubOrder> = {}): StubOrder {
  return {
    id: "order-1",
    order_number: "M22-001",
    created_at: "2026-08-08T09:00:00Z",
    customer_snapshot: { name: "ישראל", email: "israel@example.com", phone: "0501234567" },
    delivery_address_snapshot: { street: "הרצל", house_number: "1", city: "רחובות" },
    subtotal_agorot: 5000,
    delivery_fee_agorot: 0,
    discount_agorot: 0,
    total_agorot: 5000,
    fulfillment_method: "delivery",
    payment_method: "cash",
    order_status: "confirmed",
    customer_email_sent_at: null,
    admin_email_sent_at: null,
    ...overrides,
  };
}

/**
 * Models the atomic email claim: `UPDATE … WHERE <flag> IS NULL` returns a row
 * only for the first caller, which is what stops duplicate sends.
 */
function makeDb(order: StubOrder) {
  const state = { ...order };

  return {
    state,
    from(table: string) {
      if (table === "order_items") {
        return {
          select: () => ({
            eq: async () => ({ data: [], error: null }),
          }),
        };
      }

      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: state, error: null }),
          }),
        }),
        update(patch: Record<string, string | null>) {
          return {
            eq() {
              return {
                is(column: string) {
                  return {
                    select: async () => {
                      const key = column as "customer_email_sent_at" | "admin_email_sent_at";
                      if (state[key] !== null) return { data: [], error: null };
                      state[key] = patch[key] as string;
                      return { data: [{ id: state.id }], error: null };
                    },
                  };
                },
                // Unconditional update (the failure-reset path).
                then<T>(onFulfilled: (v: { data: null; error: null }) => T) {
                  Object.assign(state, patch);
                  return Promise.resolve({ data: null, error: null }).then(onFulfilled);
                },
              };
            },
          };
        },
      };
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asClient = (db: ReturnType<typeof makeDb>) => db as any;

beforeEach(() => {
  sendCustomer.mockClear();
  sendAdmin.mockClear();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Who gets emailed, and when ───────────────────────────────────────────────

describe("cash and phone-credit orders", () => {
  it("emails both the customer and the shop for a cash order", async () => {
    const db = makeDb(makeOrder({ payment_method: "cash" }));
    await sendOrderEmails("order-1", asClient(db));

    expect(sendCustomer).toHaveBeenCalledTimes(1);
    expect(sendAdmin).toHaveBeenCalledTimes(1);
  });

  it("emails both for a phone-credit order", async () => {
    const db = makeDb(makeOrder({ payment_method: "phone_credit" }));
    await sendOrderEmails("order-1", asClient(db));

    expect(sendCustomer).toHaveBeenCalledTimes(1);
    expect(sendAdmin).toHaveBeenCalledTimes(1);
  });
});

describe("the customer email is optional", () => {
  it("still notifies the shop when the customer left no email", async () => {
    // Cash and pickup checkouts do not require an email address. Losing the
    // admin notification would mean the order is never packed.
    const db = makeDb(makeOrder({ customer_snapshot: { name: "לקוח", phone: "0500000000" } }));
    await sendOrderEmails("order-1", asClient(db));

    expect(sendCustomer).not.toHaveBeenCalled();
    expect(sendAdmin).toHaveBeenCalledTimes(1);
  });

  it("still notifies the shop when there is no customer snapshot at all", async () => {
    const db = makeDb(makeOrder({ customer_snapshot: null }));
    await sendOrderEmails("order-1", asClient(db));

    expect(sendCustomer).not.toHaveBeenCalled();
    expect(sendAdmin).toHaveBeenCalledTimes(1);
  });

  it("does not consume the customer email slot when there is no address", async () => {
    // The flag must stay NULL so a later correction can still send it.
    const db = makeDb(makeOrder({ customer_snapshot: { name: "לקוח" } }));
    await sendOrderEmails("order-1", asClient(db));

    expect(db.state.customer_email_sent_at).toBeNull();
    expect(db.state.admin_email_sent_at).not.toBeNull();
  });
});

describe("idempotency", () => {
  it("does not send twice when called twice", async () => {
    // The CardCom webhook retries, and crash-recovery replays the same call.
    const db = makeDb(makeOrder());
    await sendOrderEmails("order-1", asClient(db));
    await sendOrderEmails("order-1", asClient(db));

    expect(sendCustomer).toHaveBeenCalledTimes(1);
    expect(sendAdmin).toHaveBeenCalledTimes(1);
  });

  it("sends only the missing half when one was already delivered", async () => {
    const db = makeDb(makeOrder({ customer_email_sent_at: "2026-08-08T09:01:00Z" }));
    await sendOrderEmails("order-1", asClient(db));

    expect(sendCustomer).not.toHaveBeenCalled();
    expect(sendAdmin).toHaveBeenCalledTimes(1);
  });

  it("keeps the two emails independent", async () => {
    const db = makeDb(makeOrder({ admin_email_sent_at: "2026-08-08T09:01:00Z" }));
    await sendOrderEmails("order-1", asClient(db));

    expect(sendCustomer).toHaveBeenCalledTimes(1);
    expect(sendAdmin).not.toHaveBeenCalled();
  });
});

describe("failure handling", () => {
  it("never throws, so email trouble cannot roll back a paid order", async () => {
    sendAdmin.mockRejectedValueOnce(new Error("resend down"));
    const db = makeDb(makeOrder());

    await expect(sendOrderEmails("order-1", asClient(db))).resolves.toBeUndefined();
  });

  it("does nothing when the order does not exist", async () => {
    const db = {
      from: () => ({
        select: () => ({
          eq: () => ({ single: async () => ({ data: null, error: null }) }),
        }),
      }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await sendOrderEmails("missing", db as any);

    expect(sendCustomer).not.toHaveBeenCalled();
    expect(sendAdmin).not.toHaveBeenCalled();
  });
});

// ─── Unverified CardCom attempts ──────────────────────────────────────────────

describe("unverified CardCom attempts send no operational email", () => {
  it("is never triggered by order creation for the online-card path", async () => {
    // Guard against a regression in the checkout Server Action: only the cash and
    // phone-credit branches may email at creation time. A CardCom order is
    // emailed by cardcomFinalize AFTER the webhook verifies the payment.
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("src/app/(shop)/checkout/actions.ts", "utf8")
    );

    const callIndex = source.indexOf("sendOrderEmails(");
    expect(callIndex).toBeGreaterThan(-1);

    // The only call site sits inside the offline-payment branch.
    const branchIndex = source.indexOf('paymentMethod === "cash" || paymentMethod === "phone_credit"');
    expect(branchIndex).toBeGreaterThan(-1);
    expect(branchIndex).toBeLessThan(callIndex);

    // …and it is reached before the CardCom session is ever created.
    const cardcomIndex = source.indexOf("createCardComSession(");
    expect(callIndex).toBeLessThan(cardcomIndex);
  });

  it("is only reached from cardcomFinalize after the payment is verified", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("src/lib/payment/cardcomFinalize.ts", "utf8")
    );

    // The send happens after the compare-and-set that marks the order paid.
    const casIndex = source.indexOf('payment_status:          "paid"');
    const sendIndex = source.lastIndexOf("sendOrderEmails(orderId, db)");

    expect(casIndex).toBeGreaterThan(-1);
    expect(sendIndex).toBeGreaterThan(casIndex);
  });
});

// ─── Wording ──────────────────────────────────────────────────────────────────

describe("Resend messages are order confirmations, not legal documents", () => {
  it("never calls itself a receipt or an invoice", async () => {
    const fs = await import("node:fs");
    const files = [
      "src/lib/email/service.ts",
      "src/lib/email/templates/customer-order-confirmation.ts",
      "src/lib/email/templates/admin-new-order.ts",
    ];

    // "קבלה" (receipt) as a standalone word only. The lookbehind matters: the
    // innocent word "התקבלה" ("was received"), which these emails legitimately
    // use, ends with exactly those four letters.
    const RECEIPT_WORD = /(?<![א-ת])קבלה/;
    const TAX_DOCUMENT = /חשבונית/;

    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      // CardCom issues the accounting document; a Resend email must not imply
      // it is one.
      expect(source, `${file} must not claim to be a receipt`).not.toMatch(RECEIPT_WORD);
      expect(source, `${file} must not claim to be a tax document`).not.toMatch(TAX_DOCUMENT);
      expect(source, `${file} must not claim to be an invoice`).not.toMatch(/\binvoice\b/i);
    }
  });

  it("proves the guard would catch a real receipt claim", () => {
    // Without this, the assertion above could silently pass on a broken regex.
    const RECEIPT_WORD = /(?<![א-ת])קבלה/;
    expect("להורדת קבלה לחצו כאן").toMatch(RECEIPT_WORD);
    expect("ההזמנה שלך התקבלה בהצלחה").not.toMatch(RECEIPT_WORD);
  });
});
