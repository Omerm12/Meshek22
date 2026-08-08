import { describe, expect, it } from "vitest";
import {
  EXCLUDE_INCOMPLETE_CARDCOM,
  filterRows,
  normalizeOrderRow,
  type AdminOrderRow,
} from "@/lib/admin/orders-data";

function row(overrides: Partial<AdminOrderRow> = {}): AdminOrderRow {
  return {
    id: "o1",
    order_number: "M22-1",
    order_status: "confirmed",
    payment_status: "pending",
    payment_method: "cash",
    fulfillment_method: "delivery",
    total_agorot: 1000,
    created_at: "2026-08-08T10:00:00Z",
    customer_snapshot: { name: "לקוח", phone: "0500000000" },
    ...overrides,
  };
}

describe("legacy row normalisation", () => {
  it("treats a row with no fulfillment column as a delivery", () => {
    // Pre-migration rows have no fulfillment_method at all; pickup did not exist
    // when they were placed.
    const normalized = normalizeOrderRow({
      id: "x",
      order_number: "M22-9",
      order_status: "preparing",
      payment_status: "pending",
      payment_method: null,
      total_agorot: 500,
      created_at: "2026-01-01T00:00:00Z",
      customer_snapshot: null,
    });

    expect(normalized.fulfillment_method).toBe("delivery");
    expect(normalized.payment_method).toBeNull();
  });
});

describe("employee visibility filter", () => {
  it("drops a pending online-card attempt", () => {
    const rows = [
      row({ id: "keep", payment_method: "cash" }),
      row({ id: "drop", payment_method: "credit_card", payment_status: "pending" }),
    ];
    expect(filterRows(rows).map((r) => r.id)).toEqual(["keep"]);
  });

  it("drops a failed online-card attempt", () => {
    const rows = [row({ id: "drop", payment_method: "credit_card", payment_status: "failed" })];
    expect(filterRows(rows)).toEqual([]);
  });

  it("keeps a paid online-card order", () => {
    const rows = [
      row({ id: "paid", payment_method: "credit_card", payment_status: "paid", order_status: "confirmed" }),
    ];
    expect(filterRows(rows).map((r) => r.id)).toEqual(["paid"]);
  });

  it("keeps historical rows with no recorded payment method", () => {
    // 19 of the 21 live orders look like this — hiding them would empty the panel.
    const rows = [
      row({ id: "legacy-null", payment_method: null, payment_status: "pending" }),
      row({ id: "legacy-mock", payment_method: "card_mock", payment_status: "pending" }),
    ];
    expect(filterRows(rows).map((r) => r.id)).toEqual(["legacy-null", "legacy-mock"]);
  });

  it("keeps cash and phone-credit orders that are simply unpaid", () => {
    const rows = [
      row({ id: "cash", payment_method: "cash", payment_status: "pending" }),
      row({ id: "phone", payment_method: "phone_credit", payment_status: "pending" }),
    ];
    expect(filterRows(rows)).toHaveLength(2);
  });
});

describe("bucket filtering", () => {
  const rows = [
    row({ id: "call", order_status: "pending_payment", payment_method: "phone_credit", payment_status: "pending" }),
    row({ id: "card", order_status: "pending_payment", payment_method: "credit_card", payment_status: "pending" }),
    row({ id: "new", order_status: "confirmed", payment_method: "cash" }),
    row({ id: "prep", order_status: "preparing", payment_method: "cash" }),
    row({ id: "out", order_status: "out_for_delivery", fulfillment_method: "delivery" }),
    row({ id: "pick", order_status: "out_for_delivery", fulfillment_method: "pickup" }),
    row({ id: "done", order_status: "delivered" }),
    row({ id: "void", order_status: "cancelled" }),
  ];

  it("selects only phone-credit orders awaiting a call", () => {
    expect(filterRows(rows, { bucket: "awaiting_payment_call" }).map((r) => r.id)).toEqual(["call"]);
  });

  it("separates delivery from pickup", () => {
    expect(filterRows(rows, { bucket: "out_for_delivery" }).map((r) => r.id)).toEqual(["out"]);
    expect(filterRows(rows, { bucket: "ready_for_pickup" }).map((r) => r.id)).toEqual(["pick"]);
  });

  it("never returns an incomplete card attempt in any bucket", () => {
    for (const bucket of ["awaiting_payment_call", "new", "preparing", "out_for_delivery", "ready_for_pickup", "completed", "cancelled"] as const) {
      expect(filterRows(rows, { bucket }).some((r) => r.id === "card")).toBe(false);
    }
  });

  it("excludes card attempts from the unfiltered view too", () => {
    // This is the default "הכול" list.
    expect(filterRows(rows).some((r) => r.id === "card")).toBe(false);
    expect(filterRows(rows)).toHaveLength(rows.length - 1);
  });
});

describe("EXCLUDE_INCOMPLETE_CARDCOM", () => {
  it("keeps rows whose payment method is NULL", () => {
    // In SQL, NULL <> 'credit_card' is NULL, not TRUE. Without the is.null arm
    // every historical order would silently vanish from the admin.
    expect(EXCLUDE_INCOMPLETE_CARDCOM).toContain("payment_method.is.null");
    expect(EXCLUDE_INCOMPLETE_CARDCOM).toContain("payment_method.neq.credit_card");
    expect(EXCLUDE_INCOMPLETE_CARDCOM).toContain("payment_status.eq.paid");
  });
});
