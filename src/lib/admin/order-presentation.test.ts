import { describe, expect, it } from "vitest";
import {
  BUCKET_LABELS,
  OPERATIONAL_BUCKETS,
  describeFulfillment,
  describeOrderStatus,
  describePaymentState,
  isEmployeeVisible,
  isIncompleteCardcomAttempt,
  isPickupOrder,
  matchesBucket,
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

describe("incomplete CardCom attempts", () => {
  const attempt = ctx({
    orderStatus: "pending_payment",
    paymentStatus: "pending",
    paymentMethod: "credit_card",
  });

  it("is recognised while the payment is unfinished", () => {
    expect(isIncompleteCardcomAttempt(attempt)).toBe(true);
    expect(isEmployeeVisible(attempt)).toBe(false);
    expect(isIncompleteCardcomAttempt({ ...attempt, paymentStatus: "failed" })).toBe(true);
  });

  it("becomes a real order once CardCom confirms payment", () => {
    const paid = { ...attempt, paymentStatus: "paid", orderStatus: "confirmed" };
    expect(isIncompleteCardcomAttempt(paid)).toBe(false);
    expect(isEmployeeVisible(paid)).toBe(true);
    expect(matchesBucket(paid, "new")).toBe(true);
  });

  it("does not hide cash or phone-credit orders that are simply unpaid", () => {
    expect(isEmployeeVisible(ctx({ paymentMethod: "cash", paymentStatus: "pending" }))).toBe(true);
    expect(isEmployeeVisible(ctx({ paymentMethod: "phone_credit", paymentStatus: "pending" }))).toBe(true);
  });

  it("does not hide historical orders with no recorded method", () => {
    // Most existing rows have payment_method NULL; they must stay visible.
    expect(isEmployeeVisible(ctx({ paymentMethod: null, paymentStatus: "pending" }))).toBe(true);
    expect(isEmployeeVisible(ctx({ paymentMethod: "card_mock", paymentStatus: "pending" }))).toBe(true);
  });

  it("is excluded from every bucket, including completed and cancelled", () => {
    for (const bucket of OPERATIONAL_BUCKETS) {
      expect(matchesBucket({ ...attempt, orderStatus: "delivered" }, bucket)).toBe(false);
      expect(matchesBucket({ ...attempt, orderStatus: "cancelled" }, bucket)).toBe(false);
    }
  });
});

describe("operational buckets", () => {
  it("counts only phone-credit customers as awaiting a payment call", () => {
    const waiting = ctx({
      orderStatus: "pending_payment",
      paymentStatus: "pending",
      paymentMethod: "phone_credit",
    });
    expect(matchesBucket(waiting, "awaiting_payment_call")).toBe(true);

    // Explicitly NOT: CardCom pending, CardCom failed, cash, or already paid.
    expect(matchesBucket({ ...waiting, paymentMethod: "credit_card" }, "awaiting_payment_call")).toBe(false);
    expect(
      matchesBucket({ ...waiting, paymentMethod: "credit_card", paymentStatus: "failed" }, "awaiting_payment_call")
    ).toBe(false);
    expect(matchesBucket({ ...waiting, paymentMethod: "cash" }, "awaiting_payment_call")).toBe(false);
    expect(matchesBucket({ ...waiting, paymentStatus: "paid" }, "awaiting_payment_call")).toBe(false);
  });

  it("treats a confirmed order as new, including an unpaid cash order", () => {
    expect(matchesBucket(ctx({ orderStatus: "confirmed", paymentMethod: "cash", paymentStatus: "pending" }), "new")).toBe(true);
  });

  it("separates delivery from pickup at the same enum value", () => {
    const delivery = ctx({ orderStatus: "out_for_delivery", fulfillmentMethod: "delivery" });
    const pickup   = ctx({ orderStatus: "out_for_delivery", fulfillmentMethod: "pickup" });

    expect(matchesBucket(delivery, "out_for_delivery")).toBe(true);
    expect(matchesBucket(delivery, "ready_for_pickup")).toBe(false);
    expect(matchesBucket(pickup, "ready_for_pickup")).toBe(true);
    expect(matchesBucket(pickup, "out_for_delivery")).toBe(false);
  });

  it("counts a legacy order with no fulfillment method as a delivery", () => {
    const legacy = ctx({ orderStatus: "out_for_delivery", fulfillmentMethod: null });
    expect(matchesBucket(legacy, "out_for_delivery")).toBe(true);
    expect(matchesBucket(legacy, "ready_for_pickup")).toBe(false);
  });

  it("places each visible order in at most one bucket", () => {
    for (const status of ORDER_STATUS_VALUES) {
      for (const fulfillment of ["delivery", "pickup"]) {
        const order = ctx({ orderStatus: status, fulfillmentMethod: fulfillment, paymentMethod: "cash" });
        const hits = OPERATIONAL_BUCKETS.filter((b) => matchesBucket(order, b));
        expect(hits.length, `${status}/${fulfillment}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("returns null for an unknown status rather than guessing", () => {
    expect(operationalBucketOf(ctx({ orderStatus: "some_future_status" }))).toBeNull();
  });

  it("labels every bucket in Hebrew", () => {
    for (const bucket of OPERATIONAL_BUCKETS) {
      expect(BUCKET_LABELS[bucket].length).toBeGreaterThan(0);
    }
    expect(BUCKET_LABELS.awaiting_payment_call).toBe("ממתינות לשיחת תשלום");
    expect(BUCKET_LABELS.out_for_delivery).toBe("יצאו למשלוח");
    expect(BUCKET_LABELS.ready_for_pickup).toBe("מוכנות לאיסוף");
  });
});
