/**
 * Promotion calculation engine — the single source of truth for cart pricing.
 *
 * Pure and dependency-free on purpose: the identical function is used by the
 * product card, the cart drawer, the cart page, the checkout summary, the
 * authoritative server-side checkout calculation, order creation, and the
 * CardCom document line totals. Client results are only ever cosmetic — the
 * server recomputes with the same code before an order is written.
 *
 * Guarantees
 * ----------
 *  • A promotion can only ever LOWER the price. If a bundle price is worse than
 *    the normal price of the same units, it is silently skipped.
 *  • Totals are never negative, and a line's discount never exceeds that line.
 *  • Every unit is counted at most once: a variant belongs to exactly one
 *    promotion, resolved deterministically, so group and legacy deals cannot
 *    stack on the same item.
 *  • Output is deterministic for a given input — no Map/Set iteration order or
 *    floating-point ordering leaks into the result.
 *
 * Algorithm (mix-and-match "any N for ₪X")
 * ----------------------------------------
 *  1. Pool every eligible unit across all products in the promotion.
 *  2. groups = floor(totalUnits / requiredQuantity) complete groups are charged
 *     at the bundle price; leftover units stay at their normal price.
 *  3. The most expensive units are the ones placed into the groups, which is the
 *     arrangement that maximises the customer's saving.
 *  4. The resulting saving is distributed back over the contributing lines by
 *     the largest-remainder method, so the per-line amounts sum exactly to the
 *     cart discount with no rounding drift.
 */

import type {
  AppliedPromotion,
  CartPricing,
  LinePricing,
  PricedItem,
  Promotion,
  PromotionProgress,
} from "@/lib/promotions/types";

/** Prefix used for the promotion id of a legacy products.qty_deal_* deal. */
const LEGACY_PREFIX = "legacy:";

/**
 * True when an applied-promotion id refers to a legacy per-product qty_deal
 * rather than a row in the `promotions` table.
 */
export function isLegacyPromotionId(promotionId: string | null): boolean {
  return promotionId !== null && promotionId.startsWith(LEGACY_PREFIX);
}

/** Normal (undiscounted) total for a line, in agorot. */
export function normalLineTotalAgorot(item: PricedItem): number {
  return Math.round(item.priceAgorot * item.quantity);
}

/** True when a promotion is enabled and `now` falls inside its optional window. */
export function isPromotionLive(promotion: Promotion, now: Date = new Date()): boolean {
  if (!promotion.isActive) return false;
  if (promotion.requiredQuantity < 2) return false;
  if (promotion.bundlePriceAgorot < 0) return false;
  if (promotion.eligibleVariantIds.length === 0) return false;

  const t = now.getTime();
  if (promotion.startsAt !== null) {
    const start = Date.parse(promotion.startsAt);
    if (Number.isFinite(start) && t < start) return false;
  }
  if (promotion.endsAt !== null) {
    const end = Date.parse(promotion.endsAt);
    if (Number.isFinite(end) && t >= end) return false;
  }
  return true;
}

/**
 * Resolve which promotion owns each variant.
 *
 * Promotions are considered in a stable order (sortOrder, then id). The first
 * promotion to claim a variant keeps it, so a variant that — through a data
 * anomaly — appears in two live promotions is still only ever discounted once.
 */
export function buildVariantPromotionMap(
  promotions: Promotion[],
  now: Date = new Date()
): Map<string, Promotion> {
  const live = promotions
    .filter((p) => isPromotionLive(p, now))
    .sort((a, b) => a.sortOrder - b.sortOrder || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const map = new Map<string, Promotion>();
  for (const promotion of live) {
    for (const variantId of [...promotion.eligibleVariantIds].sort()) {
      if (!map.has(variantId)) map.set(variantId, promotion);
    }
  }
  return map;
}

/**
 * Distribute `total` over `weights` using the largest-remainder method.
 * Returns an array of integers that sums to exactly `total`.
 */
function allocateByLargestRemainder(total: number, weights: number[]): number[] {
  const weightSum = weights.reduce((s, w) => s + w, 0);
  const out = new Array<number>(weights.length).fill(0);
  if (total <= 0 || weightSum <= 0) return out;

  const remainders: { index: number; remainder: number }[] = [];
  let allocated = 0;

  for (let i = 0; i < weights.length; i++) {
    const exact = (total * weights[i]) / weightSum;
    const floored = Math.floor(exact);
    out[i] = floored;
    allocated += floored;
    remainders.push({ index: i, remainder: exact - floored });
  }

  // Ties broken by index so the result is fully deterministic.
  remainders.sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  let leftover = total - allocated;
  for (let i = 0; i < remainders.length && leftover > 0; i++) {
    out[remainders[i].index] += 1;
    leftover--;
  }
  return out;
}

/** A single purchasable unit pulled out of a line, used to fill promotion groups. */
interface EligibleUnit {
  lineIndex: number;
  priceAgorot: number;
  variantId: string;
}

/**
 * Price a cart.
 *
 * @param items       Cart lines. Server callers must pass prices freshly read
 *                    from the database — never values echoed by the browser.
 * @param promotions  All promotions to consider. Expired/disabled ones are
 *                    filtered out here, so callers may pass everything they have.
 * @param now         Injectable clock, for tests and for server/client parity.
 */
export function calculateCartPricing(
  items: PricedItem[],
  promotions: Promotion[] = [],
  now: Date = new Date()
): CartPricing {
  // ── Base lines at normal price ─────────────────────────────────────────────
  const lines: LinePricing[] = items.map((item) => {
    const normalTotalAgorot = normalLineTotalAgorot(item);
    return {
      variantId: item.variantId,
      quantity: item.quantity,
      unitPriceAgorot: item.priceAgorot,
      normalTotalAgorot,
      discountAgorot: 0,
      chargedTotalAgorot: normalTotalAgorot,
      appliedPromotionId: null,
    };
  });

  const appliedPromotions: AppliedPromotion[] = [];
  const progress: PromotionProgress[] = [];

  const variantPromotion = buildVariantPromotionMap(promotions, now);

  // ── Group ("mix and match") promotions ─────────────────────────────────────
  //
  // Collect the eligible units for each live promotion. Only whole units of
  // fixed-price variants participate: a per_kg variant is priced by weight and
  // an "N for ₪X" rule is undefined for it, so it is excluded (the database
  // also refuses to add per_kg variants to a promotion).
  const unitsByPromotion = new Map<string, EligibleUnit[]>();
  const claimedLineIndexes = new Set<number>();

  for (let lineIndex = 0; lineIndex < items.length; lineIndex++) {
    const item = items[lineIndex];
    const promotion = variantPromotion.get(item.variantId);
    if (!promotion) continue;
    if (item.quantityPricingMode === "per_kg") continue;

    const wholeUnits = Math.floor(item.quantity);
    if (wholeUnits < 1) continue;

    // The variant is governed by a group promotion — the legacy per-product deal
    // must not also fire for it.
    claimedLineIndexes.add(lineIndex);

    const bucket = unitsByPromotion.get(promotion.id) ?? [];
    for (let u = 0; u < wholeUnits; u++) {
      bucket.push({ lineIndex, priceAgorot: item.priceAgorot, variantId: item.variantId });
    }
    unitsByPromotion.set(promotion.id, bucket);
  }

  // Iterate promotions in the same deterministic order used to claim variants.
  const livePromotions = promotions
    .filter((p) => isPromotionLive(p, now))
    .sort((a, b) => a.sortOrder - b.sortOrder || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  for (const promotion of livePromotions) {
    const units = unitsByPromotion.get(promotion.id);
    if (!units || units.length === 0) continue;

    const groups = Math.floor(units.length / promotion.requiredQuantity);

    if (groups === 0) {
      progress.push({
        promotionId: promotion.id,
        name: promotion.name,
        requiredQuantity: promotion.requiredQuantity,
        bundlePriceAgorot: promotion.bundlePriceAgorot,
        currentQuantity: units.length,
        missingQuantity: promotion.requiredQuantity - units.length,
      });
      continue;
    }

    // Most expensive units first so the customer saves the most possible.
    const ordered = [...units].sort(
      (a, b) =>
        b.priceAgorot - a.priceAgorot ||
        (a.variantId < b.variantId ? -1 : a.variantId > b.variantId ? 1 : 0) ||
        a.lineIndex - b.lineIndex
    );

    const bundledCount = groups * promotion.requiredQuantity;
    const bundled = ordered.slice(0, bundledCount);

    const normalBundledAgorot = bundled.reduce((s, u) => s + u.priceAgorot, 0);
    const promotionalAgorot = groups * promotion.bundlePriceAgorot;
    const discountAgorot = Math.max(0, normalBundledAgorot - promotionalAgorot);

    // Show remaining-units progress for the NEXT group even once one applied.
    const leftover = units.length - bundledCount;
    if (leftover > 0) {
      progress.push({
        promotionId: promotion.id,
        name: promotion.name,
        requiredQuantity: promotion.requiredQuantity,
        bundlePriceAgorot: promotion.bundlePriceAgorot,
        currentQuantity: leftover,
        missingQuantity: promotion.requiredQuantity - leftover,
      });
    }

    // A bundle that costs more than the normal price is never applied.
    if (discountAgorot === 0) continue;

    // Weight each contributing line by the value it put into the groups.
    const weightByLine = new Map<number, number>();
    for (const unit of bundled) {
      weightByLine.set(unit.lineIndex, (weightByLine.get(unit.lineIndex) ?? 0) + unit.priceAgorot);
    }

    const lineIndexes = [...weightByLine.keys()].sort((a, b) => a - b);
    const weights = lineIndexes.map((i) => weightByLine.get(i)!);
    const allocations = allocateByLargestRemainder(discountAgorot, weights);

    let actuallyAllocated = 0;
    for (let i = 0; i < lineIndexes.length; i++) {
      const line = lines[lineIndexes[i]];
      // Clamp: a line can never be discounted below zero.
      const allocated = Math.min(allocations[i], line.normalTotalAgorot - line.discountAgorot);
      line.discountAgorot += allocated;
      line.chargedTotalAgorot = line.normalTotalAgorot - line.discountAgorot;
      line.appliedPromotionId = promotion.id;
      actuallyAllocated += allocated;
    }

    appliedPromotions.push({
      promotionId: promotion.id,
      name: promotion.name,
      requiredQuantity: promotion.requiredQuantity,
      bundlePriceAgorot: promotion.bundlePriceAgorot,
      groupsApplied: groups,
      discountAgorot: actuallyAllocated,
      source: "group",
    });
  }

  // ── Legacy single-product quantity deals (products.qty_deal_*) ─────────────
  //
  // Only for lines NOT governed by a group promotion, so the two never stack.
  for (let lineIndex = 0; lineIndex < items.length; lineIndex++) {
    if (claimedLineIndexes.has(lineIndex)) continue;

    const item = items[lineIndex];
    const dealQuantity = item.dealQuantity ?? null;
    const dealPriceAgorot = item.dealPriceAgorot ?? null;

    if (!item.dealEnabled || dealQuantity === null || dealPriceAgorot === null) continue;
    if (dealQuantity < 1) continue;

    const line = lines[lineIndex];

    if (item.quantity < dealQuantity) {
      progress.push({
        promotionId: `${LEGACY_PREFIX}${item.productId}`,
        name: `${dealQuantity} במחיר מיוחד`,
        requiredQuantity: dealQuantity,
        bundlePriceAgorot: dealPriceAgorot,
        currentQuantity: item.quantity,
        missingQuantity: dealQuantity - item.quantity,
      });
      continue;
    }

    const groups = Math.floor(item.quantity / dealQuantity);
    const remainder = item.quantity - groups * dealQuantity;
    const promotionalTotal =
      groups * dealPriceAgorot + Math.round(remainder * item.priceAgorot);
    const discountAgorot = Math.max(0, line.normalTotalAgorot - promotionalTotal);

    if (remainder > 0) {
      progress.push({
        promotionId: `${LEGACY_PREFIX}${item.productId}`,
        name: `${dealQuantity} במחיר מיוחד`,
        requiredQuantity: dealQuantity,
        bundlePriceAgorot: dealPriceAgorot,
        currentQuantity: remainder,
        missingQuantity: dealQuantity - remainder,
      });
    }

    if (discountAgorot === 0) continue;

    line.discountAgorot = discountAgorot;
    line.chargedTotalAgorot = line.normalTotalAgorot - discountAgorot;
    line.appliedPromotionId = `${LEGACY_PREFIX}${item.productId}`;

    appliedPromotions.push({
      promotionId: `${LEGACY_PREFIX}${item.productId}`,
      name: `${dealQuantity} במחיר מיוחד`,
      requiredQuantity: dealQuantity,
      bundlePriceAgorot: dealPriceAgorot,
      groupsApplied: groups,
      discountAgorot,
      source: "legacy",
    });
  }

  const subtotalAgorot = lines.reduce((s, l) => s + l.normalTotalAgorot, 0);
  const discountAgorot = lines.reduce((s, l) => s + l.discountAgorot, 0);

  return {
    lines,
    subtotalAgorot,
    discountAgorot,
    chargedSubtotalAgorot: Math.max(0, subtotalAgorot - discountAgorot),
    appliedPromotions,
    progress,
  };
}

/**
 * Hebrew nudge for a promotion the cart has not yet completed, e.g.
 * "הוסיפו עוד 2 פריטים לקבלת 4 ב־10 ₪".
 */
export function formatPromotionProgress(p: PromotionProgress): string {
  const price = (p.bundlePriceAgorot / 100).toLocaleString("he-IL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  const itemWord = p.missingQuantity === 1 ? "פריט" : "פריטים";
  return `הוסיפו עוד ${p.missingQuantity} ${itemWord} לקבלת ${p.requiredQuantity} ב־${price} ₪`;
}

/** Short Hebrew label for an active deal badge, e.g. "4 ב־10 ₪". */
export function formatPromotionBadge(requiredQuantity: number, bundlePriceAgorot: number): string {
  const price = (bundlePriceAgorot / 100).toLocaleString("he-IL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${requiredQuantity} ב־${price} ₪`;
}
