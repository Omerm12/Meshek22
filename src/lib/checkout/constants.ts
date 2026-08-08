/**
 * Checkout fulfillment and payment vocabulary.
 *
 * These string values are written to orders.fulfillment_method and
 * orders.payment_method and are enforced by CHECK constraints in the database,
 * so they must stay in sync with migration 20260808_003.
 */

export const FULFILLMENT_METHODS = ["delivery", "pickup"] as const;
export type FulfillmentMethod = (typeof FULFILLMENT_METHODS)[number];

export const PAYMENT_METHODS = ["credit_card", "cash", "phone_credit"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

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
