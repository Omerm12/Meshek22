import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Orders list: each page marks which paid card orders have a Cardcom tax invoice
 * (so the list can offer view/print), and the list renders the right action.
 */

const { dbRef } = vi.hoisted(() => ({ dbRef: { current: null as unknown } }));

vi.mock("@/lib/admin/auth", () => ({ requireAdmin: vi.fn(async () => {}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/payment/cardcomFinalize", () => ({ recoverPaymentByOrderId: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => dbRef.current }));

import { fetchOrdersPage, type OrderRow } from "./actions";
import { OrdersListClient } from "@/components/admin/orders/OrdersListClient";

const ID = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

function listRow(n: number, over: Record<string, unknown> = {}) {
  return {
    id: ID(n), order_number: `M22-00${n}`, order_status: "confirmed", payment_status: "paid",
    fulfillment_method: "delivery", payment_method: "credit_card", total_agorot: 10000,
    created_at: `2026-10-0${n}T10:00:00Z`, customer_snapshot: { name: "לקוח", phone: "050" },
    ...over,
  };
}

const meta = (id: string, doc: unknown) => ({
  ResponseCode: 0, ReturnValue: id, TranzactionInfo: { ResponseCode: 0, TranzactionId: 1 }, DocumentInfo: doc,
});

/** First select → the list page; select().in() → the invoice-state read. */
function makeDb(list: unknown[], invoiceRows: unknown[] | null, invoiceError: unknown = null) {
  const calls = { invoiceQueries: 0, invoiceIds: [] as string[], writes: 0 };
  const builder = (): unknown => {
    let isInvoiceQuery = false;
    const chain: Record<string, unknown> = new Proxy({}, {
      get(_t, prop: string) {
        if (prop === "then") {
          return (resolve: (v: unknown) => void) =>
            resolve(isInvoiceQuery ? { data: invoiceRows, error: invoiceError } : { data: list, error: null });
        }
        if (["insert", "update", "upsert", "delete"].includes(prop)) {
          return () => { calls.writes++; return chain; };
        }
        return (...args: unknown[]) => {
          if (prop === "in") { isInvoiceQuery = true; calls.invoiceQueries++; calls.invoiceIds = args[1] as string[]; }
          return chain;
        };
      },
    });
    return chain;
  };
  return { calls, from: () => builder() };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("fetchOrdersPage — invoice state", () => {
  it("marks tax-invoice orders available, Order-only orders missing, and skips unpaid / cash orders", async () => {
    const list = [
      listRow(1),                                                    // paid card, tax invoice
      listRow(2),                                                    // paid card, only an Order doc
      listRow(3, { payment_method: "cash" }),                        // cash
      listRow(4, { payment_method: "cash", payment_status: "pending" }), // cash, unpaid
    ];
    const db = makeDb(list, [
      { id: ID(1), payment_method: "credit_card", payment_status: "paid",
        payment_metadata: meta(ID(1), { ResponseCode: 0, DocumentType: "TaxInvoiceAndReceipt", DocumentNumber: 33 }) },
      { id: ID(2), payment_method: "credit_card", payment_status: "paid",
        payment_metadata: meta(ID(2), { ResponseCode: 0, DocumentType: "Order", DocumentNumber: 3 }) },
    ]);
    dbRef.current = db;

    const result = await fetchOrdersPage(null, {});
    const byId = Object.fromEntries(result.orders.map((o) => [o.id, o.invoice]));
    expect(byId).toEqual({ [ID(1)]: "available", [ID(2)]: "missing", [ID(3)]: "none", [ID(4)]: "none" });

    // Only the paid card orders on the page are looked at; nothing is written.
    expect(db.calls.invoiceQueries).toBe(1);
    expect(db.calls.invoiceIds.sort()).toEqual([ID(1), ID(2)]);
    expect(db.calls.writes).toBe(0);
  });

  it("does not run the extra read when no order on the page is a paid card order", async () => {
    const db = makeDb([listRow(3, { payment_method: "cash" })], []);
    dbRef.current = db;
    const result = await fetchOrdersPage(null, {});
    expect(result.orders[0].invoice).toBe("none");
    expect(db.calls.invoiceQueries).toBe(0);
  });

  it("a failed invoice read leaves the list intact with no invoice actions", async () => {
    dbRef.current = makeDb([listRow(1)], null, { code: "XX000", message: "boom" });
    const result = await fetchOrdersPage(null, {});
    expect(result.failed).toBe(false);
    expect(result.orders).toHaveLength(1);
    expect(result.orders[0].invoice).toBe("none");
  });

  it("an order whose stored result belongs to another order is 'missing', never linked", async () => {
    dbRef.current = makeDb([listRow(1)], [
      { id: ID(1), payment_method: "credit_card", payment_status: "paid",
        payment_metadata: meta(ID(9), { ResponseCode: 0, DocumentType: "TaxInvoiceAndReceipt", DocumentNumber: 33 }) },
    ]);
    const result = await fetchOrdersPage(null, {});
    expect(result.orders[0].invoice).toBe("missing");
  });
});

describe("OrdersListClient — invoice actions", () => {
  const row = (n: number, invoice: OrderRow["invoice"]): OrderRow => ({ ...listRow(n), invoice } as OrderRow);
  const render = (orders: OrderRow[]) =>
    renderToStaticMarkup(
      createElement(OrdersListClient, { initialOrders: orders, initialNextCursor: null, filters: {}, hasActiveFilters: false })
    );

  it("shows view + print links for an order with an invoice", () => {
    const html = render([row(1, "available")]);
    expect(html).toContain("צפייה בחשבונית");
    expect(html).toContain("הדפסת חשבונית");
    expect(html).toContain(`/meshek22-control/orders/${ID(1)}/invoice`);
    expect(html).toContain("?print=1");
  });

  it("shows 'לא נמצאה חשבונית' instead of broken buttons when there is none", () => {
    const html = render([row(2, "missing")]);
    expect(html).toContain("לא נמצאה חשבונית");
    expect(html).not.toContain("הדפסת חשבונית");
  });

  it("shows nothing invoice-related for unpaid / non-card orders", () => {
    const html = render([row(3, "none")]);
    expect(html).not.toContain("חשבונית");
  });
});
