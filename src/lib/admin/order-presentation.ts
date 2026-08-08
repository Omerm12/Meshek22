/**
 * How an order is described to the shop owner.
 *
 * The database enum values (`pending_payment`, `out_for_delivery`, …) are kept
 * exactly as they are — they are referenced by historical orders, the checkout
 * flow and the CardCom webhook. This module is the single place that turns those
 * internal values into the words a non-technical person reads.
 *
 * The same enum value can mean two different things operationally, so the label
 * depends on context:
 *   • `pending_payment` on a CardCom order means "waiting for the card company";
 *     on a phone-credit order it means "someone has to ring the customer".
 *   • `out_for_delivery` on a delivery order means it left the farm; on a pickup
 *     order it means it is packed and waiting on the shelf.
 *
 * Pure and dependency-free so the dashboard, the order list, the filters and the
 * order-detail page all read from one definition instead of four copies.
 */

// ─── Domain values ────────────────────────────────────────────────────────────

export const ORDER_STATUS_VALUES = [
  "pending_payment",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;

export type OrderStatusValue = (typeof ORDER_STATUS_VALUES)[number];

export const PAYMENT_STATUS_VALUES = ["pending", "paid", "failed", "refunded"] as const;
export type PaymentStatusValue = (typeof PAYMENT_STATUS_VALUES)[number];

export function isOrderStatus(value: unknown): value is OrderStatusValue {
  return typeof value === "string" && (ORDER_STATUS_VALUES as readonly string[]).includes(value);
}

export function isPaymentStatus(value: unknown): value is PaymentStatusValue {
  return typeof value === "string" && (PAYMENT_STATUS_VALUES as readonly string[]).includes(value);
}

/**
 * Everything needed to describe an order.
 *
 * All fields are widened to `string | null` on purpose: historical orders predate
 * the current vocabulary (they carry `payment_method = 'card_mock'` or NULL, and
 * no `fulfillment_method` at all), and every helper here must still produce
 * something sensible for them rather than throwing or rendering blank.
 */
export interface OrderPresentationContext {
  orderStatus: string;
  paymentStatus: string;
  paymentMethod: string | null;
  fulfillmentMethod: string | null;
}

export interface Presentation {
  label: string;
  /** Tailwind classes for a badge. */
  cls: string;
}

const NEUTRAL_CLS = "bg-gray-100 text-gray-600 border-gray-200";

/**
 * Pickup only when explicitly recorded as such.
 *
 * Orders created before the fulfillment column existed are delivery orders —
 * pickup did not exist as an option then — so NULL means delivery.
 */
export function isPickupOrder(ctx: Pick<OrderPresentationContext, "fulfillmentMethod">): boolean {
  return ctx.fulfillmentMethod === "pickup";
}

// ─── Order status ─────────────────────────────────────────────────────────────

export function describeOrderStatus(ctx: OrderPresentationContext): Presentation {
  const pickup = isPickupOrder(ctx);

  switch (ctx.orderStatus) {
    case "pending_payment":
      if (ctx.paymentMethod === "phone_credit") {
        return {
          label: "צריך להתקשר ללקוח",
          cls: "bg-amber-50 text-amber-800 border-amber-200",
        };
      }
      if (ctx.paymentMethod === "credit_card") {
        return {
          label: "ממתינה לאישור התשלום",
          cls: "bg-yellow-50 text-yellow-800 border-yellow-200",
        };
      }
      // Cash, legacy (`card_mock`) and NULL land here.
      return { label: "ממתינה לתשלום", cls: "bg-yellow-50 text-yellow-800 border-yellow-200" };

    case "confirmed":
      return { label: "הזמנה חדשה", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" };

    case "preparing":
      return { label: "בהכנה", cls: "bg-purple-50 text-purple-700 border-purple-200" };

    case "out_for_delivery":
      return pickup
        ? { label: "מוכנה לאיסוף", cls: "bg-teal-50 text-teal-700 border-teal-200" }
        : { label: "יצאה למשלוח", cls: "bg-orange-50 text-orange-700 border-orange-200" };

    case "delivered":
      return pickup
        ? { label: "נאספה והושלמה", cls: "bg-green-50 text-green-700 border-green-200" }
        : { label: "נמסרה והושלמה", cls: "bg-green-50 text-green-700 border-green-200" };

    case "cancelled":
      return { label: "בוטלה", cls: NEUTRAL_CLS };

    default:
      // An enum value this build does not know about still renders readably.
      return { label: ctx.orderStatus || "לא ידוע", cls: NEUTRAL_CLS };
  }
}

// ─── Payment state ────────────────────────────────────────────────────────────

export function describePaymentState(ctx: OrderPresentationContext): Presentation {
  const pickup = isPickupOrder(ctx);

  switch (ctx.paymentStatus) {
    case "paid":
      return { label: "שולם", cls: "bg-green-50 text-green-700 border-green-200" };

    case "failed":
      return { label: "התשלום נכשל", cls: "bg-red-50 text-red-700 border-red-200" };

    case "refunded":
      return { label: "בוצע החזר", cls: NEUTRAL_CLS };

    case "pending":
      if (ctx.paymentMethod === "credit_card") {
        return {
          label: "ממתין לאישור CardCom",
          cls: "bg-yellow-50 text-yellow-800 border-yellow-200",
        };
      }
      if (ctx.paymentMethod === "cash") {
        return pickup
          ? { label: "מזומן בעת האיסוף", cls: "bg-sky-50 text-sky-700 border-sky-200" }
          : { label: "מזומן בעת המסירה", cls: "bg-sky-50 text-sky-700 border-sky-200" };
      }
      if (ctx.paymentMethod === "phone_credit") {
        return {
          label: "טרם שולם – צריך להתקשר",
          cls: "bg-amber-50 text-amber-800 border-amber-200",
        };
      }
      // Legacy or unrecorded payment method.
      return { label: "ממתין לתשלום", cls: "bg-yellow-50 text-yellow-800 border-yellow-200" };

    default:
      return { label: ctx.paymentStatus || "לא ידוע", cls: NEUTRAL_CLS };
  }
}

// ─── Operational grouping ─────────────────────────────────────────────────────

/**
 * An online card payment that was started but never completed.
 *
 * Creating the order row BEFORE sending the customer to CardCom is deliberate
 * and must not change: the webhook needs a trusted record to verify against
 * (internal id, expected total, guest token hash, idempotency key, LowProfileId).
 *
 * But a started-and-abandoned checkout is not an order anyone should pack. These
 * rows are kept for audit, idempotency and retry, and hidden from every normal
 * employee view until CardCom itself confirms the payment.
 *
 * Note the deliberate narrowness: only `credit_card` counts. A legacy row with
 * NULL or `card_mock` as its method is a real historical order and stays visible.
 */
export function isIncompleteCardcomAttempt(
  ctx: Pick<OrderPresentationContext, "paymentMethod" | "paymentStatus">
): boolean {
  return ctx.paymentMethod === "credit_card" && ctx.paymentStatus !== "paid";
}

/** The inverse: may this order appear in normal employee screens? */
export function isEmployeeVisible(
  ctx: Pick<OrderPresentationContext, "paymentMethod" | "paymentStatus">
): boolean {
  return !isIncompleteCardcomAttempt(ctx);
}

/**
 * The buckets the shop owner actually thinks in, used by both the dashboard
 * cards and the order-list filters so a card always opens the matching filter.
 *
 * Delivery and pickup are separate buckets even though they share one enum
 * value: "out for delivery" and "waiting on the shelf" are different jobs.
 */
export const OPERATIONAL_BUCKETS = [
  "awaiting_payment_call",
  "new",
  "preparing",
  "out_for_delivery",
  "ready_for_pickup",
  "completed",
  "cancelled",
] as const;

export type OperationalBucket = (typeof OPERATIONAL_BUCKETS)[number];

export const BUCKET_LABELS: Record<OperationalBucket, string> = {
  awaiting_payment_call: "ממתינות לשיחת תשלום",
  new:                   "הזמנות חדשות",
  preparing:             "בהכנה",
  out_for_delivery:      "יצאו למשלוח",
  ready_for_pickup:      "מוכנות לאיסוף",
  completed:             "הושלמו",
  cancelled:             "בוטלו",
};

/**
 * A bucket's membership rule, in a form both a database query and an in-memory
 * filter can consume, so the dashboard count and the filtered list can never
 * disagree about what a bucket means.
 */
export interface BucketRule {
  orderStatuses: OrderStatusValue[];
  paymentMethod?: string;
  paymentStatus?: PaymentStatusValue;
  fulfillmentMethod?: "delivery" | "pickup";
}

export const BUCKET_RULES: Record<OperationalBucket, BucketRule> = {
  // Only customers who asked to be called back. Never a CardCom attempt, never
  // cash, never an order that is already paid.
  awaiting_payment_call: {
    orderStatuses: ["pending_payment"],
    paymentMethod: "phone_credit",
    paymentStatus: "pending",
  },
  new:              { orderStatuses: ["confirmed"] },
  preparing:        { orderStatuses: ["preparing"] },
  out_for_delivery: { orderStatuses: ["out_for_delivery"], fulfillmentMethod: "delivery" },
  ready_for_pickup: { orderStatuses: ["out_for_delivery"], fulfillmentMethod: "pickup" },
  completed:        { orderStatuses: ["delivered"] },
  cancelled:        { orderStatuses: ["cancelled"] },
};

export function isOperationalBucket(value: unknown): value is OperationalBucket {
  return typeof value === "string" && (OPERATIONAL_BUCKETS as readonly string[]).includes(value);
}

/**
 * Does this order belong in `bucket`?
 *
 * Incomplete CardCom attempts are excluded from every bucket — including
 * "cancelled" and "completed" — because they are not part of the operational
 * workflow at all.
 */
export function matchesBucket(ctx: OrderPresentationContext, bucket: OperationalBucket): boolean {
  if (!isEmployeeVisible(ctx)) return false;

  const rule = BUCKET_RULES[bucket];
  if (!(rule.orderStatuses as string[]).includes(ctx.orderStatus)) return false;
  if (rule.paymentMethod && ctx.paymentMethod !== rule.paymentMethod) return false;
  if (rule.paymentStatus && ctx.paymentStatus !== rule.paymentStatus) return false;
  if (rule.fulfillmentMethod) {
    const pickup = isPickupOrder(ctx);
    if (rule.fulfillmentMethod === "pickup" && !pickup) return false;
    if (rule.fulfillmentMethod === "delivery" && pickup) return false;
  }
  return true;
}

/** The bucket an order currently sits in, or null if it is not operational. */
export function operationalBucketOf(ctx: OrderPresentationContext): OperationalBucket | null {
  for (const bucket of OPERATIONAL_BUCKETS) {
    if (matchesBucket(ctx, bucket)) return bucket;
  }
  return null;
}

// ─── Fulfillment ──────────────────────────────────────────────────────────────

export function describeFulfillment(
  ctx: Pick<OrderPresentationContext, "fulfillmentMethod">
): Presentation {
  return isPickupOrder(ctx)
    ? { label: "איסוף עצמי", cls: "bg-amber-50 text-amber-700 border-amber-200" }
    : { label: "משלוח", cls: "bg-sky-50 text-sky-700 border-sky-200" };
}
