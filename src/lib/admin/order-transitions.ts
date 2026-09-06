/**
 * The order workflow: which action is offered, and what it is allowed to do.
 *
 * This module is pure and is the ONLY definition of the rules. The buttons on
 * the order page are rendered from `getAvailableActions`, and the Server Action
 * re-derives the same decision through `resolveTransition` against a freshly
 * read order. Hiding a button is a convenience; `resolveTransition` is the
 * control — a forged request that names an action gets the same verdict.
 *
 * Two rules matter most:
 *   1. A CardCom order can never be marked paid from here. Only the verified
 *      webhook (or the separate, explicitly-labelled recovery path) may do that.
 *   2. Transitions only ever move forward, one stage at a time. There is no
 *      "set any status to any value" action any more.
 */

import {
  isPickupOrder,
  type OrderPresentationContext,
  type OrderStatusValue,
  type PaymentStatusValue,
} from "@/lib/admin/order-presentation";

export const TRANSITION_ACTIONS = [
  "phone_credit_paid",
  "recheck_cardcom_payment",
  "start_preparing",
  "mark_out_for_delivery",
  "mark_ready_for_pickup",
  "mark_delivered",
  "mark_picked_up",
  "cancel",
] as const;

export type TransitionAction = (typeof TRANSITION_ACTIONS)[number];

/**
 * "recheck_cardcom_payment" does not fit the CAS-write shape every other
 * action has: it calls out to CardCom and lets the shared finalizer's own
 * atomic compare-and-set decide the outcome, rather than writing a
 * pre-decided next status. The Server Action must special-case it before
 * reaching resolveTransition/the generic update.
 */
export function isCardcomRecheckAction(action: TransitionAction): boolean {
  return action === "recheck_cardcom_payment";
}

export function isTransitionAction(value: unknown): value is TransitionAction {
  return typeof value === "string" && (TRANSITION_ACTIONS as readonly string[]).includes(value);
}

/** A button to render on the order page. */
export interface AvailableAction {
  action: TransitionAction;
  label: string;
  tone: "primary" | "danger";
  /**
   * The action collects cash at the same time, so the admin must confirm the
   * money was actually handed over before the order is marked paid.
   */
  requiresCashConfirmation: boolean;
  /** Shown in the confirmation step, when there is one. */
  confirmMessage?: string;
}

/** A read-only note shown instead of a button, e.g. while CardCom decides. */
export interface StatusNote {
  message: string;
  tone: "info";
}

const ACTIVE_STATUSES: OrderStatusValue[] = [
  "pending_payment",
  "confirmed",
  "preparing",
  "out_for_delivery",
];

/** True when the order is still in flight and may be cancelled. */
export function isActiveOrder(orderStatus: string): boolean {
  return (ACTIVE_STATUSES as string[]).includes(orderStatus);
}

/**
 * Cash that has not been collected yet. Used to decide whether completing an
 * order should also settle the payment.
 */
function isUncollectedCash(ctx: OrderPresentationContext): boolean {
  return ctx.paymentMethod === "cash" && ctx.paymentStatus !== "paid";
}

// ─── What to show ─────────────────────────────────────────────────────────────

/**
 * The buttons for an order in its current state.
 *
 * Returns at most one forward action plus, for an order still in flight, the
 * cancel action. An order with no forward action (a completed one, a CardCom
 * order awaiting the webhook, or a historical order in a state this workflow
 * does not cover) simply gets fewer buttons — never a broken page.
 */
export function getAvailableActions(ctx: OrderPresentationContext): AvailableAction[] {
  const actions: AvailableAction[] = [];
  const pickup = isPickupOrder(ctx);

  switch (ctx.orderStatus) {
    case "pending_payment": {
      // Only phone-credit can be settled by hand: the shop takes the card
      // details over the phone on their own terminal, so the site never sees
      // them and no webhook is coming.
      if (ctx.paymentMethod === "phone_credit" && ctx.paymentStatus !== "paid") {
        actions.push({
          action: "phone_credit_paid",
          label: "התשלום הושלם – אשר הזמנה",
          tone: "primary",
          requiresCashConfirmation: false,
          confirmMessage: "לאשר שהתשלום התקבל מהלקוח והזמנה תעבור לטיפול?",
        });
      }
      // A card order still waiting on the webhook. This never marks the order
      // paid by itself — it asks CardCom directly through the same verified
      // path the webhook uses, in case the webhook was delayed or lost.
      if (ctx.paymentMethod === "credit_card" && ctx.paymentStatus !== "paid") {
        actions.push({
          action: "recheck_cardcom_payment",
          label: "בדיקת סטטוס מול קארדקום",
          tone: "primary",
          requiresCashConfirmation: false,
        });
      }
      break;
    }

    case "confirmed": {
      actions.push({
        action: "start_preparing",
        label: "התחל הכנה",
        tone: "primary",
        requiresCashConfirmation: false,
      });
      break;
    }

    case "preparing": {
      actions.push(
        pickup
          ? {
              action: "mark_ready_for_pickup",
              label: "סמן כמוכנה לאיסוף",
              tone: "primary",
              requiresCashConfirmation: false,
            }
          : {
              action: "mark_out_for_delivery",
              label: "סמן כיצאה למשלוח",
              tone: "primary",
              requiresCashConfirmation: false,
            }
      );
      break;
    }

    case "out_for_delivery": {
      const cashDue = isUncollectedCash(ctx);
      actions.push(
        pickup
          ? {
              action: "mark_picked_up",
              label: "סמן כנאספה והושלמה",
              tone: "primary",
              requiresCashConfirmation: cashDue,
              confirmMessage: cashDue
                ? "לאשר שהתקבל התשלום במזומן בעת האיסוף?"
                : undefined,
            }
          : {
              action: "mark_delivered",
              label: "סמן כנמסרה והושלמה",
              tone: "primary",
              requiresCashConfirmation: cashDue,
              confirmMessage: cashDue
                ? "לאשר שהתקבל התשלום במזומן בעת המסירה?"
                : undefined,
            }
      );
      break;
    }

    default:
      break;
  }

  if (isActiveOrder(ctx.orderStatus)) {
    actions.push({
      action: "cancel",
      label: "בטל הזמנה",
      tone: "danger",
      requiresCashConfirmation: false,
      confirmMessage: "לבטל את ההזמנה? הפעולה אינה הפיכה.",
    });
  }

  return actions;
}

/**
 * A read-only explanation when the admin cannot act and should not try.
 * Currently only the CardCom wait, which is the state most likely to tempt
 * someone into marking an order paid by hand.
 */
export function getStatusNote(ctx: OrderPresentationContext): StatusNote | null {
  if (
    ctx.orderStatus === "pending_payment" &&
    ctx.paymentMethod === "credit_card" &&
    ctx.paymentStatus !== "paid"
  ) {
    return {
      message: "ממתינה לאישור אוטומטי מחברת האשראי",
      tone: "info",
    };
  }
  return null;
}

// ─── What is allowed ──────────────────────────────────────────────────────────

export interface ResolvedTransition {
  ok: true;
  /** Status the order must still be in for the update to apply (compare-and-set). */
  expectedOrderStatus: OrderStatusValue;
  nextOrderStatus: OrderStatusValue;
  /** Only set when the action also settles payment. */
  nextPaymentStatus?: PaymentStatusValue;
}

export interface RejectedTransition {
  ok: false;
  /** Hebrew, safe to show the admin. Never leaks internal detail. */
  error: string;
}

export type TransitionResult = ResolvedTransition | RejectedTransition;

const STALE_ERROR =
  "סטטוס ההזמנה השתנה בינתיים. רעננו את הדף ונסו שוב.";

/**
 * Decide whether `action` may be applied to an order in state `ctx`.
 *
 * Called by the Server Action with the order as just read from the database, so
 * a stale page, a double click or a hand-crafted request all reach the same
 * verdict as the rendered buttons would have.
 */
export function resolveTransition(
  action: TransitionAction,
  ctx: OrderPresentationContext
): TransitionResult {
  const pickup = isPickupOrder(ctx);

  switch (action) {
    case "phone_credit_paid": {
      // Guarded hard: this is the only action that sets payment to paid, and it
      // must never be reachable for a CardCom order.
      if (ctx.paymentMethod !== "phone_credit") {
        return {
          ok: false,
          error:
            "ניתן לאשר תשלום ידנית רק בהזמנה שסומנה לתשלום טלפוני. תשלום באשראי באתר מאושר אוטומטית.",
        };
      }
      if (ctx.orderStatus !== "pending_payment") return { ok: false, error: STALE_ERROR };
      if (ctx.paymentStatus === "paid") {
        return { ok: false, error: "ההזמנה כבר מסומנת כשולמה." };
      }
      return {
        ok: true,
        expectedOrderStatus: "pending_payment",
        nextOrderStatus: "confirmed",
        nextPaymentStatus: "paid",
      };
    }

    case "start_preparing": {
      if (ctx.orderStatus !== "confirmed") return { ok: false, error: STALE_ERROR };
      // Payment is deliberately NOT required: a cash order is confirmed at
      // checkout and is packed long before the money changes hands.
      return {
        ok: true,
        expectedOrderStatus: "confirmed",
        nextOrderStatus: "preparing",
      };
    }

    case "mark_out_for_delivery": {
      if (ctx.orderStatus !== "preparing") return { ok: false, error: STALE_ERROR };
      if (pickup) {
        return { ok: false, error: "ההזמנה מסומנת לאיסוף עצמי ולכן אינה יוצאת למשלוח." };
      }
      return {
        ok: true,
        expectedOrderStatus: "preparing",
        nextOrderStatus: "out_for_delivery",
      };
    }

    case "mark_ready_for_pickup": {
      if (ctx.orderStatus !== "preparing") return { ok: false, error: STALE_ERROR };
      if (!pickup) {
        return { ok: false, error: "ההזמנה מסומנת למשלוח ולכן אינה ממתינה לאיסוף." };
      }
      // Same stored value as a delivery leaving the farm; only the wording differs.
      return {
        ok: true,
        expectedOrderStatus: "preparing",
        nextOrderStatus: "out_for_delivery",
      };
    }

    case "mark_delivered":
    case "mark_picked_up": {
      if (ctx.orderStatus !== "out_for_delivery") return { ok: false, error: STALE_ERROR };
      if (action === "mark_picked_up" && !pickup) {
        return { ok: false, error: "ההזמנה מסומנת למשלוח ולכן אינה נאספת." };
      }
      if (action === "mark_delivered" && pickup) {
        return { ok: false, error: "ההזמנה מסומנת לאיסוף עצמי ולכן אינה נמסרת במשלוח." };
      }
      return {
        ok: true,
        expectedOrderStatus: "out_for_delivery",
        nextOrderStatus: "delivered",
        // Completing a cash order is when the money arrives. Any other method is
        // left alone: an unpaid CardCom order stays unpaid.
        nextPaymentStatus: isUncollectedCash(ctx) ? "paid" : undefined,
      };
    }

    case "cancel": {
      if (!isActiveOrder(ctx.orderStatus)) {
        return { ok: false, error: "לא ניתן לבטל הזמנה שכבר הושלמה או בוטלה." };
      }
      return {
        ok: true,
        expectedOrderStatus: ctx.orderStatus as OrderStatusValue,
        nextOrderStatus: "cancelled",
      };
    }

    default:
      return { ok: false, error: "פעולה לא מוכרת." };
  }
}

/**
 * True when the action settles cash and therefore needs the admin to confirm
 * the money was received. The Server Action requires the matching flag.
 */
export function actionRequiresCashConfirmation(
  action: TransitionAction,
  ctx: OrderPresentationContext
): boolean {
  if (action !== "mark_delivered" && action !== "mark_picked_up") return false;
  return isUncollectedCash(ctx);
}
