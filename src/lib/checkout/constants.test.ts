import { describe, expect, it } from "vitest";
import {
  NEW_ORDER_PAYMENT_METHODS,
  PAYMENT_METHODS,
  PAYMENT_LABELS,
  paymentMethodLabel,
  isPaymentMethod,
} from "@/lib/checkout/constants";

describe("checkout payment vocabulary", () => {
  it("offers exactly two payment methods for a new order, in the required order", () => {
    expect(NEW_ORDER_PAYMENT_METHODS).toEqual(["credit_card", "cash"]);
  });

  it("keeps phone_credit in the full historical vocabulary, for old orders", () => {
    expect(PAYMENT_METHODS).toContain("phone_credit");
    expect(isPaymentMethod("phone_credit")).toBe(true);
  });

  it("still renders a readable label for a historical phone_credit order", () => {
    expect(paymentMethodLabel("phone_credit")).toBe(PAYMENT_LABELS.phone_credit);
    expect(paymentMethodLabel("phone_credit")).toBe("נציג יתקשר לקבלת פרטי אשראי");
  });

  it("has the exact Hebrew labels the checkout must display, in order", () => {
    expect(PAYMENT_LABELS.credit_card).toBe("תשלום מאובטח באשראי באתר");
    expect(PAYMENT_LABELS.cash).toBe("תשלום במזומן בעת קבלת ההזמנה");
  });
});
