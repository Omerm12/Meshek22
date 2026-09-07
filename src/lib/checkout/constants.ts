/**
 * Checkout fulfillment and payment vocabulary.
 *
 * These string values are written to orders.fulfillment_method and
 * orders.payment_method and are enforced by CHECK constraints in the database,
 * so they must stay in sync with migration 20260808_003.
 */

export const FULFILLMENT_METHODS = ["delivery", "pickup"] as const;
export type FulfillmentMethod = (typeof FULFILLMENT_METHODS)[number];

/**
 * Every payment-method value that can exist on an order, past or present.
 * "phone_credit" is no longer offered at checkout (see NEW_ORDER_PAYMENT_METHODS
 * below) but is kept here so historical orders keep reading, labelling and
 * transitioning correctly in the admin portal — removing it from this list
 * would also have to be reflected in the DB CHECK constraint, which would then
 * reject any UPDATE (e.g. cancelling, marking delivered) to an old
 * phone_credit order.
 */
export const PAYMENT_METHODS = ["credit_card", "cash", "phone_credit"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * Payment methods a NEW order may be created with. The "נציג יתקשר לקבלת פרטי
 * אשראי" (phone_credit) option was removed from checkout — the storefront no
 * longer offers it and the server rejects it on new submissions — but it is
 * intentionally absent from this narrower list rather than from
 * PAYMENT_METHODS itself. Used by checkoutSchema to validate new orders.
 */
export const NEW_ORDER_PAYMENT_METHODS = ["credit_card", "cash"] as const;
export type NewOrderPaymentMethod = (typeof NEW_ORDER_PAYMENT_METHODS)[number];

export const FULFILLMENT_LABELS: Record<FulfillmentMethod, string> = {
  delivery: "משלוח",
  pickup:   "איסוף עצמי",
};

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  credit_card:  "תשלום מאובטח באשראי באתר",
  cash:         "תשלום במזומן בעת קבלת ההזמנה",
  phone_credit: "נציג יתקשר לקבלת פרטי אשראי",
};

/** Compact labels for admin tables and badges, where the full sentence is too long. */
export const PAYMENT_LABELS_SHORT: Record<PaymentMethod, string> = {
  credit_card:  "אשראי באתר",
  cash:         "מזומן",
  phone_credit: "אשראי בטלפון",
};

/**
 * Self-collection point.
 *
 * Opening hours are deliberately NOT stated: none have been supplied by the
 * business, and inventing them would mislead customers. Until real hours exist,
 * the customer is told the shop will call to arrange a time.
 */
export const PICKUP_LOCATION = {
  name: "משק 22, מושב ינון",
  /** Shown wherever pickup is selected. Replace once real hours are provided. */
  coordinationNote: "ניצור אתכם קשר טלפוני לתיאום מועד האיסוף.",
} as const;

export function isFulfillmentMethod(value: unknown): value is FulfillmentMethod {
  return typeof value === "string" && (FULFILLMENT_METHODS as readonly string[]).includes(value);
}

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === "string" && (PAYMENT_METHODS as readonly string[]).includes(value);
}

/** Hebrew label for a payment method value read back from the database. */
export function paymentMethodLabel(value: string | null, short = false): string {
  if (!value) return "לא צוין";
  if (!isPaymentMethod(value)) {
    // Legacy orders may carry historical values such as "card_mock".
    return "כרטיס אשראי";
  }
  return short ? PAYMENT_LABELS_SHORT[value] : PAYMENT_LABELS[value];
}

/** Hebrew label for a fulfillment method value read back from the database. */
export function fulfillmentMethodLabel(value: string | null): string {
  return isFulfillmentMethod(value) ? FULFILLMENT_LABELS[value] : FULFILLMENT_LABELS.delivery;
}
