/**
 * Shared promotion types.
 *
 * These types are deliberately framework-free and serialisable so the exact same
 * shapes flow through: storefront rendering → cart drawer → cart page →
 * checkout summary → authoritative server-side pricing → order creation →
 * CardCom document lines.
 */

/** Only one promotion type exists today; the field keeps the model extensible. */
export type PromotionType = "mix_and_match_quantity";

/**
 * A group ("mix and match") promotion: ANY `requiredQuantity` units drawn from
 * `eligibleVariantIds` cost `bundlePriceAgorot` in total.
 */
export interface Promotion {
  id: string;
  name: string;
  description: string | null;
  promotionType: PromotionType;
  requiredQuantity: number;
  bundlePriceAgorot: number;
  isActive: boolean;
  /** ISO timestamp or null for "no start bound". */
  startsAt: string | null;
  /** ISO timestamp or null for "no end bound". */
  endsAt: string | null;
  sortOrder: number;
  eligibleVariantIds: string[];
}

/**
 * The minimum a cart line must expose for pricing. Both the client cart store
 * and the server-side re-validated cart satisfy this shape.
 */
export interface PricedItem {
  variantId: string;
  productId: string;
  quantity: number;
  priceAgorot: number;
  /** 'per_kg' lines are priced by weight and never take part in group promotions. */
  quantityPricingMode: "per_kg" | "fixed";
  /** Legacy single-product quantity deal (products.qty_deal_*). */
  dealEnabled?: boolean;
  dealQuantity?: number | null;
  dealPriceAgorot?: number | null;
}

/** Per-line pricing result. */
export interface LinePricing {
  variantId: string;
  quantity: number;
  unitPriceAgorot: number;
  /** Undiscounted line total: what the line costs before any promotion. */
  normalTotalAgorot: number;
  /** Promotion saving allocated to this line. Always 0 ≤ discount ≤ normalTotal. */
  discountAgorot: number;
  /** normalTotalAgorot − discountAgorot. Never negative. */
  chargedTotalAgorot: number;
  /** Promotion id when a group promotion applied; 'legacy:<productId>' for a qty_deal. */
  appliedPromotionId: string | null;
}

/** One promotion's contribution to the cart, for display and for the order snapshot. */
export interface AppliedPromotion {
  promotionId: string;
  name: string;
  requiredQuantity: number;
  bundlePriceAgorot: number;
  /** How many complete qualifying groups were charged at the bundle price. */
  groupsApplied: number;
  discountAgorot: number;
  source: "group" | "legacy";
}

/**
 * A promotion the cart is partially qualified for — drives the
 * "הוסיפו עוד 2 פריטים לקבלת 4 ב־10 ₪" nudge.
 */
export interface PromotionProgress {
  promotionId: string;
  name: string;
  requiredQuantity: number;
  bundlePriceAgorot: number;
  /** Eligible units currently in the cart. */
  currentQuantity: number;
  /** Units still needed to complete the NEXT group. Always ≥ 1. */
  missingQuantity: number;
}

export interface CartPricing {
  lines: LinePricing[];
  /** Σ normalTotalAgorot — matches orders.subtotal_agorot. */
  subtotalAgorot: number;
  /** Σ discountAgorot — matches orders.discount_agorot. */
  discountAgorot: number;
  /** subtotalAgorot − discountAgorot. Never negative. */
  chargedSubtotalAgorot: number;
  appliedPromotions: AppliedPromotion[];
  progress: PromotionProgress[];
}
