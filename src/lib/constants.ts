export const BRAND_NAME = "משק 22";
export const BRAND_TAGLINE = "ירקות ופירות טריים";

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_payment: "ממתין לתשלום",
  paid: "שולם",
  confirmed: "אושר",
  preparing: "בהכנה",
  out_for_delivery: "בדרך אליך",
  delivered: "נמסר",
  cancelled: "בוטל",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "ממתין",
  paid: "שולם",
  failed: "נכשל",
  refunded: "הוחזר",
};

export const VARIANT_UNIT_LABELS: Record<string, string> = {
  unit: "יחידה",
  "250g": "250 גרם",
  "500g": "500 גרם",
  "1kg": '1 ק"ג',
  "2kg": '2 ק"ג',
  bunch: "צרור",
  pack: "מארז",
};

// Cart session cookie name (for unauthenticated users)
export const CART_SESSION_COOKIE = "meshek22_cart_session";

// Stale cart cleanup threshold (days)
export const CART_STALE_DAYS = 30;
