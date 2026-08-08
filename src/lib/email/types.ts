/**
 * Shared types for the email service layer.
 * These are plain data objects — no Supabase types leak here.
 */

export interface OrderEmailItem {
  productName: string;
  variantLabel: string;
  quantity: number;
  unitPriceAgorot: number;
  totalPriceAgorot: number;
}

export interface OrderEmailData {
  /** UUID from the orders table — used to build the admin deep-link */
  orderId: string;
  /** Human-readable order number, e.g. "ORD-20240418-001" */
  orderNumber: string;
  /** ISO timestamp — typically new Date().toISOString() at creation time */
  createdAt: string;

  // ── Customer ────────────────────────────────────────────────────────────────
  customerName: string;
  customerEmail: string;
  customerPhone: string;

  // ── Delivery address ────────────────────────────────────────────────────────
  addressStreet: string;
  addressHouseNumber: string;
  /** Apartment / floor number, null if not provided */
  addressApartment: string | null;
  addressCity: string;
  /** Free-text delivery notes from the customer, null if not provided */
  deliveryNotes: string | null;

  // ── Items ───────────────────────────────────────────────────────────────────
  items: OrderEmailItem[];

  // ── Totals (all in agorot — 1/100 of a shekel) ─────────────────────────────
  subtotalAgorot: number;
  deliveryFeeAgorot: number;
  /** Total promotion saving. Omitted or 0 when no promotion applied. */
  discountAgorot?: number;
  totalAgorot: number;

  // ── Fulfillment ─────────────────────────────────────────────────────────────
  /** "delivery" or "pickup". Defaults to delivery for legacy orders. */
  fulfillmentMethod?: string | null;

  // ── Payment ─────────────────────────────────────────────────────────────────
  /** Raw payment method key, e.g. "cash" — mapped to a Hebrew label in the template */
  paymentMethod: string | null;
  /** Raw order status key, e.g. "confirmed" */
  orderStatus: string;
}

export type EmailSendResult = { ok: true } | { ok: false; error: string };
