import { describe, expect, it } from "vitest";
import {
  BUCKET_STATUSES,
  describeFulfillment,
  describeOrderStatus,
  describePaymentState,
  isPickupOrder,
  operationalBucketOf,
  ORDER_STATUS_VALUES,
  type OrderPresentationContext,
} from "@/lib/admin/order-presentation";

function ctx(overrides: Partial<OrderPresentationContext> = {}): OrderPresentationContext {
  return {
    orderStatus: "confirmed",
    paymentStatus: "pending",
    paymentMethod: "cash",
    fulfillmentMethod: "delivery",
    ...overrides,
  };
}

describe("order status wording", () => {
  it("distinguishes a CardCom wait from a phone call to make", () => {
    expect(
      describeOrderStatus(ctx({ orderStatus: "pending_payment", paymentMethod: "credit_card" }))
        .label
    ).toBe("ממתינה לאישור התשלום");

    expect(
      describeOrderStatus(ctx({ orderStatus: "pending_payment", paymentMethod: "phone_credit" }))
        .label
    ).toBe("צריך להתקשר ללקוח");
  });

  it("calls a confirmed order a new order", () => {
    expect(describeOrderStatus(ctx({ orderStatus: "confirmed" })).label).toBe("הזמנה חדשה");
  });

  it("names preparing plainly", () => {
    expect(describeOrderStatus(ctx({ orderStatus: "preparing" })).label).toBe("בהכנה");
  });

  it("reads out_for_delivery differently for delivery and pickup", () => {
    expect(
      describeOrderStatus(ctx({ orderStatus: "out_for_delivery", fulfillmentMethod: "delivery" }))
        .label
    ).toBe("יצאה למשלוח");

    expect(
      describeOrderStatus(ctx({ orderStatus: "out_for_delivery", fulfillmentMethod: "pickup" }))
        .label
    ).toBe("מוכנה לאיסוף");
  });

  it("reads delivered differently for delivery and pickup", () => {
    expect(
      describeOrderStatus(ctx({ orderStatus: "delivered", fulfillmentMethod: "delivery" })).label
    ).toBe("נמסרה והושלמה");

    expect(
      describeOrderStatus(ctx({ orderStatus: "delivered", fulfillmentMethod: "pickup" })).label
    ).toBe("נאספה והושלמה");
  });

  it("names a cancelled order", () => {
    expect(describeOrderStatus(ctx({ orderStatus: "cancelled" })).label).toBe("בוטלה");
  });

  it("gives every known status a label and a colour", () => {
    for (const status of ORDER_STATUS_VALUES) {
      const p = describeOrderStatus(ctx({ orderStatus: status }));
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.cls.length).toBeGreaterThan(0);
    }
  });

  it("degrades gracefully for an unknown status", () => {
    const p = describeOrderStatus(ctx({ orderStatus: "some_future_status" }));
    expect(p.label).toBe("some_future_status");
    expect(p.cls).toContain("gray");
  });
});

describe("payment wording", () => {
  it("says CardCom is still deciding", () => {
    expect(
      describePaymentState(ctx({ paymentStatus: "pending", paymentMethod: "credit_card" })).label
    ).toBe("ממתין לאישור CardCom");
  });

  it("says where cash will be collected", () => {
    expect(
      describePaymentState(
        ctx({ paymentStatus: "pending", paymentMethod: "cash", fulfillmentMethod: "delivery" })
      ).label
    ).toBe("מזומן בעת המסירה");

    expect(
      describePaymentState(
        ctx({ paymentStatus: "pending", paymentMethod: "cash", fulfillmentMethod: "pickup" })
      ).label
    ).toBe("מזומן בעת האיסוף");
  });

  it("says a phone-credit order still needs a call", () => {
    expect(
      describePaymentState(ctx({ paymentStatus: "pending", paymentMethod: "phone_credit" })).label
    ).toBe("טרם שולם – צריך להתקשר");
  });

  it("uses the plain settled states", () => {
    expect(describePaymentState(ctx({ paymentStatus: "paid" })).label).toBe("שולם");
    expect(describePaymentState(ctx({ paymentStatus: "failed" })).label).toBe("התשלום נכשל");
    expect(describePaymentState(ctx({ paymentStatus: "refunded" })).label).toBe("בוצע החזר");
  });

  it("handles a legacy order with no recorded payment method", () => {
    // Historical rows carry payment_method NULL or 'card_mock'.
    expect(
      describePaymentState(ctx({ paymentStatus: "pending", paymentMethod: null })).label
    ).toBe("ממתין לתשלום");
    expect(
      describePaymentState(ctx({ paymentStatus: "pending", paymentMethod: "card_mock" })).label
    ).toBe("ממתין לתשלום");
    // A legacy paid order still reads correctly.
    expect(
      describePaymentState(ctx({ paymentStatus: "paid", paymentMethod: "card_mock" })).label
    ).toBe("שולם");
  });

  it("degrades gracefully for an unknown payment status", () => {
    expect(describePaymentState(ctx({ paymentStatus: "chargeback" })).label).toBe("chargeback");
  });
});

describe("fulfillment", () => {
  it("treats a missing fulfillment method as delivery", () => {
    // Orders placed before the column existed predate pickup entirely.
    expect(isPickupOrder({ fulfillmentMethod: null })).toBe(false);
    expect(describeFulfillment({ fulfillmentMethod: null }).label).toBe("משלוח");
  });

  it("recognises pickup only when explicitly recorded", () => {
    expect(isPickupOrder({ fulfillmentMethod: "pickup" })).toBe(true);
    expect(describeFulfillment({ fulfillmentMethod: "pickup" }).label).toBe("איסוף עצמי");
  });
});

describe("operational buckets", () => {
  it("maps every status to exactly one bucket", () => {
    for (const status of ORDER_STATUS_VALUES) {
      const bucket = operationalBucketOf(status);
      expect(bucket, `${status} should belong to a bucket`).not.toBeNull();

      const matching = Object.entries(BUCKET_STATUSES).filter(([, list]) =>
        (list as string[]).includes(status)
      );
      expect(matching).toHaveLength(1);
    }
  });

  it("puts unpaid orders in the attention bucket", () => {
    expect(operationalBucketOf("pending_payment")).toBe("attention");
  });

  it("returns null for an unknown status rather than guessing", () => {
    expect(operationalBucketOf("some_future_status")).toBeNull();
  });
});
