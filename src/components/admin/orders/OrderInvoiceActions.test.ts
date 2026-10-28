import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OrderInvoiceActions } from "./OrderInvoiceActions";

const ID = "11111111-2222-4333-8444-555555555555";
const meta = (doc: unknown) => ({
  ResponseCode: 0, ReturnValue: ID, TranzactionInfo: { ResponseCode: 0, TranzactionId: 1 }, DocumentInfo: doc,
});
const render = (order: Parameters<typeof OrderInvoiceActions>[0]["order"]) =>
  renderToStaticMarkup(createElement(OrderInvoiceActions, { order }));

describe("OrderInvoiceActions", () => {
  it("offers view and print for a paid card order with a tax invoice", () => {
    const html = render({
      id: ID, payment_method: "credit_card", payment_status: "paid",
      payment_metadata: meta({ ResponseCode: 0, DocumentType: "TaxInvoiceAndReceipt", DocumentNumber: 33 }) as never,
    });
    expect(html).toContain("צפייה בחשבונית");
    expect(html).toContain("הדפסת חשבונית");
    expect(html).toContain(`/meshek22-control/orders/${ID}/invoice`);
    expect(html).toContain("?print=1");
  });

  it("shows 'לא נמצאה חשבונית' (no buttons) for a paid order without one", () => {
    const html = render({
      id: ID, payment_method: "credit_card", payment_status: "paid",
      payment_metadata: meta({ ResponseCode: 0, DocumentType: "Order", DocumentNumber: 3 }) as never,
    });
    expect(html).toContain("לא נמצאה חשבונית");
    expect(html).not.toContain("<a ");
  });

  it("renders nothing for unpaid or non-card orders", () => {
    expect(render({ id: ID, payment_method: "credit_card", payment_status: "pending", payment_metadata: null })).toBe("");
    expect(render({ id: ID, payment_method: "cash", payment_status: "paid", payment_metadata: null })).toBe("");
  });
});
