import { describe, expect, it } from "vitest";
import {
  actionRequiresCashConfirmation,
  getAvailableActions,
  getStatusNote,
  isActiveOrder,
  resolveTransition,
  TRANSITION_ACTIONS,
  type TransitionAction,
} from "@/lib/admin/order-transitions";
import type { OrderPresentationContext } from "@/lib/admin/order-presentation";

function ctx(overrides: Partial<OrderPresentationContext> = {}): OrderPresentationContext {
  return {
    orderStatus: "confirmed",
    paymentStatus: "pending",
    paymentMethod: "cash",
    fulfillmentMethod: "delivery",
    ...overrides,
  };
}

const labels = (c: OrderPresentationContext) => getAvailableActions(c).map((a) => a.label);
const actionNames = (c: OrderPresentationContext) => getAvailableActions(c).map((a) => a.action);

// ─── Phone credit ─────────────────────────────────────────────────────────────

describe("phone-credit payment completion", () => {
  const phonePending = ctx({
    orderStatus: "pending_payment",
    paymentStatus: "pending",
    paymentMethod: "phone_credit",
  });

  it("offers the completion button", () => {
    expect(labels(phonePending)).toContain("התשלום הושלם – אשר הזמנה");
  });

  it("confirms the order and marks it paid in one step", () => {
    const result = resolveTransition("phone_credit_paid", phonePending);
    expect(result).toEqual({
      ok: true,
      expectedOrderStatus: "pending_payment",
      nextOrderStatus: "confirmed",
      nextPaymentStatus: "paid",
    });
  });

  it("cannot be applied twice", () => {
    const alreadyPaid = { ...phonePending, paymentStatus: "paid" };
    const result = resolveTransition("phone_credit_paid", alreadyPaid);
    expect(result.ok).toBe(false);
  });
});

// ─── CardCom ──────────────────────────────────────────────────────────────────

describe("CardCom orders cannot be settled by hand", () => {
  const cardPending = ctx({
    orderStatus: "pending_payment",
    paymentStatus: "pending",
    paymentMethod: "credit_card",
  });

  it("offers no manual settlement action, only a CardCom recheck and cancellation", () => {
    expect(actionNames(cardPending)).not.toContain("phone_credit_paid");
    expect(actionNames(cardPending)).toEqual(["recheck_cardcom_payment", "cancel"]);
  });

  it("the recheck action is absent once the order is actually paid", () => {
    const paid = { ...cardPending, paymentStatus: "paid" };
    expect(actionNames(paid)).not.toContain("recheck_cardcom_payment");
  });

  it("explains that the card company decides", () => {
    expect(getStatusNote(cardPending)?.message).toBe("ממתינה לאישור אוטומטי מחברת האשראי");
  });

  it("rejects a forged phone_credit_paid request on a CardCom order", () => {
    // The button is absent, but the Server Action must refuse it regardless.
    const result = resolveTransition("phone_credit_paid", cardPending);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("אוטומטית");
  });

  it("never yields a transition that marks a CardCom order paid", () => {
    for (const action of TRANSITION_ACTIONS) {
      const result = resolveTransition(action as TransitionAction, cardPending);
      if (result.ok) expect(result.nextPaymentStatus).toBeUndefined();
    }
  });

  it("does not settle payment when a CardCom order is completed", () => {
    const shipped = { ...cardPending, orderStatus: "out_for_delivery" };
    const result = resolveTransition("mark_delivered", shipped);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.nextOrderStatus).toBe("delivered");
      expect(result.nextPaymentStatus).toBeUndefined();
    }
  });
});

// ─── Cash ─────────────────────────────────────────────────────────────────────

describe("cash orders", () => {
  it("may start preparation while payment is still pending", () => {
    const cashConfirmed = ctx({
      orderStatus: "confirmed",
      paymentStatus: "pending",
      paymentMethod: "cash",
    });

    expect(labels(cashConfirmed)).toContain("התחל הכנה");

    const result = resolveTransition("start_preparing", cashConfirmed);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.nextOrderStatus).toBe("preparing");
      // Payment is untouched — the money arrives on handover.
      expect(result.nextPaymentStatus).toBeUndefined();
    }
  });

  it("settles the cash when a delivery is completed", () => {
    const outForDelivery = ctx({
      orderStatus: "out_for_delivery",
      paymentStatus: "pending",
      paymentMethod: "cash",
      fulfillmentMethod: "delivery",
    });

    const result = resolveTransition("mark_delivered", outForDelivery);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.nextPaymentStatus).toBe("paid");
  });

  it("settles the cash when a pickup is collected", () => {
    const readyForPickup = ctx({
      orderStatus: "out_for_delivery",
      paymentStatus: "pending",
      paymentMethod: "cash",
      fulfillmentMethod: "pickup",
    });

    const result = resolveTransition("mark_picked_up", readyForPickup);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.nextPaymentStatus).toBe("paid");
  });

  it("requires an explicit confirmation before marking cash received", () => {
    const cashDue = ctx({
      orderStatus: "out_for_delivery",
      paymentStatus: "pending",
      paymentMethod: "cash",
    });

    expect(actionRequiresCashConfirmation("mark_delivered", cashDue)).toBe(true);
    const [action] = getAvailableActions(cashDue);
    expect(action.requiresCashConfirmation).toBe(true);
    expect(action.confirmMessage).toContain("מזומן");
  });

  it("asks for no cash confirmation when the money already arrived", () => {
    const alreadyPaid = ctx({
      orderStatus: "out_for_delivery",
      paymentStatus: "paid",
      paymentMethod: "cash",
    });

    expect(actionRequiresCashConfirmation("mark_delivered", alreadyPaid)).toBe(false);
    const result = resolveTransition("mark_delivered", alreadyPaid);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.nextPaymentStatus).toBeUndefined();
  });
});

// ─── Delivery vs pickup ───────────────────────────────────────────────────────

describe("delivery-specific workflow", () => {
  const preparingDelivery = ctx({ orderStatus: "preparing", fulfillmentMethod: "delivery" });

  it("offers the delivery wording", () => {
    expect(labels(preparingDelivery)).toContain("סמן כיצאה למשלוח");
  });

  it("moves preparing → out_for_delivery", () => {
    const result = resolveTransition("mark_out_for_delivery", preparingDelivery);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.nextOrderStatus).toBe("out_for_delivery");
  });

  it("refuses the pickup action on a delivery order", () => {
    expect(resolveTransition("mark_ready_for_pickup", preparingDelivery).ok).toBe(false);
  });

  it("completes with the delivery wording", () => {
    const shipped = ctx({ orderStatus: "out_for_delivery", fulfillmentMethod: "delivery" });
    expect(labels(shipped)).toContain("סמן כנמסרה והושלמה");
    expect(resolveTransition("mark_picked_up", shipped).ok).toBe(false);
  });
});

describe("pickup-specific workflow", () => {
  const preparingPickup = ctx({ orderStatus: "preparing", fulfillmentMethod: "pickup" });

  it("offers the pickup wording", () => {
    expect(labels(preparingPickup)).toContain("סמן כמוכנה לאיסוף");
  });

  it("stores the same enum value as a delivery leaving the farm", () => {
    const result = resolveTransition("mark_ready_for_pickup", preparingPickup);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.nextOrderStatus).toBe("out_for_delivery");
  });

  it("refuses the delivery action on a pickup order", () => {
    expect(resolveTransition("mark_out_for_delivery", preparingPickup).ok).toBe(false);
  });

  it("completes with the pickup wording", () => {
    const ready = ctx({ orderStatus: "out_for_delivery", fulfillmentMethod: "pickup" });
    expect(labels(ready)).toContain("סמן כנאספה והושלמה");
    expect(resolveTransition("mark_delivered", ready).ok).toBe(false);
  });
});

// ─── Guard rails ──────────────────────────────────────────────────────────────

describe("invalid and backward transitions", () => {
  it("rejects skipping a stage", () => {
    // confirmed → out_for_delivery is not a step the workflow allows.
    expect(resolveTransition("mark_out_for_delivery", ctx({ orderStatus: "confirmed" })).ok).toBe(false);
    expect(resolveTransition("mark_delivered", ctx({ orderStatus: "preparing" })).ok).toBe(false);
  });

  it("rejects going backwards", () => {
    expect(resolveTransition("start_preparing", ctx({ orderStatus: "out_for_delivery" })).ok).toBe(false);
    expect(resolveTransition("start_preparing", ctx({ orderStatus: "delivered" })).ok).toBe(false);
    expect(
      resolveTransition("phone_credit_paid", ctx({ orderStatus: "delivered", paymentMethod: "phone_credit" })).ok
    ).toBe(false);
  });

  it("offers nothing on a completed order", () => {
    expect(getAvailableActions(ctx({ orderStatus: "delivered" }))).toEqual([]);
    expect(getAvailableActions(ctx({ orderStatus: "cancelled" }))).toEqual([]);
  });

  it("reports a stale page rather than silently applying", () => {
    const result = resolveTransition("start_preparing", ctx({ orderStatus: "preparing" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("רעננו");
  });

  it("always names the status the update must compare against", () => {
    // This is what makes two concurrent clicks safe: the second UPDATE matches
    // no rows because the status already moved on.
    const result = resolveTransition("start_preparing", ctx({ orderStatus: "confirmed" }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.expectedOrderStatus).toBe("confirmed");
      expect(result.expectedOrderStatus).not.toBe(result.nextOrderStatus);
    }
  });
});

describe("cancellation", () => {
  it("is offered on every active order", () => {
    for (const status of ["pending_payment", "confirmed", "preparing", "out_for_delivery"]) {
      expect(actionNames(ctx({ orderStatus: status }))).toContain("cancel");
    }
  });

  it("requires a confirmation step", () => {
    const cancel = getAvailableActions(ctx({ orderStatus: "confirmed" })).find(
      (a) => a.action === "cancel"
    );
    expect(cancel?.tone).toBe("danger");
    expect(cancel?.confirmMessage).toBeTruthy();
  });

  it("is refused once the order is finished", () => {
    expect(isActiveOrder("delivered")).toBe(false);
    expect(resolveTransition("cancel", ctx({ orderStatus: "delivered" })).ok).toBe(false);
    expect(resolveTransition("cancel", ctx({ orderStatus: "cancelled" })).ok).toBe(false);
  });

  it("compares against the status it was resolved from", () => {
    const result = resolveTransition("cancel", ctx({ orderStatus: "preparing" }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.expectedOrderStatus).toBe("preparing");
      expect(result.nextOrderStatus).toBe("cancelled");
    }
  });
});

describe("historical orders", () => {
  it("still moves through the workflow with a legacy payment method", () => {
    const legacy = ctx({
      orderStatus: "confirmed",
      paymentStatus: "paid",
      paymentMethod: "card_mock",
      fulfillmentMethod: null,
    });

    expect(labels(legacy)).toContain("התחל הכנה");
    expect(resolveTransition("start_preparing", legacy).ok).toBe(true);
  });

  it("treats a legacy order with no fulfillment method as a delivery", () => {
    const legacy = ctx({ orderStatus: "preparing", fulfillmentMethod: null });
    expect(labels(legacy)).toContain("סמן כיצאה למשלוח");
  });

  it("offers no action for an unrecognised status instead of throwing", () => {
    const odd = ctx({ orderStatus: "archived" });
    expect(() => getAvailableActions(odd)).not.toThrow();
    expect(getAvailableActions(odd)).toEqual([]);
  });
});
