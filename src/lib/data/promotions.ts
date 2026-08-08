/**
 * Server-side promotion queries.
 *
 * Uses the cookie-free public client so promotion reads stay ISR-cacheable and
 * never trigger a customer auth round-trip. RLS on `promotions` /
 * `promotion_items` already limits anonymous reads to promotions that are live
 * right now; isPromotionLive() re-checks in JS so the same rule holds even when
 * a caller passes rows fetched through the service-role client.
 */

import { createPublicClient } from "@/lib/supabase/public";
import { isPromotionLive } from "@/lib/promotions/engine";
import type { Promotion } from "@/lib/promotions/types";

interface PromotionRow {
  id: string;
  name: string;
  description: string | null;
  promotion_type: string;
  required_quantity: number;
  bundle_price_agorot: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
  promotion_items: { product_variant_id: string }[] | null;
}

const PROMOTION_SELECT = `
  id, name, description, promotion_type, required_quantity, bundle_price_agorot,
  is_active, starts_at, ends_at, sort_order,
  promotion_items ( product_variant_id )
`;

export function toPromotion(row: PromotionRow): Promotion {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    promotionType: "mix_and_match_quantity",
    requiredQuantity: row.required_quantity,
    bundlePriceAgorot: row.bundle_price_agorot,
    isActive: row.is_active,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    sortOrder: row.sort_order,
    eligibleVariantIds: (row.promotion_items ?? []).map((i) => i.product_variant_id),
  };
}

/**
 * Every promotion that is enabled and inside its date window right now.
 * Returns an empty array on any error so the storefront degrades to normal
 * pricing rather than failing to render.
 */
export async function fetchLivePromotions(): Promise<Promotion[]> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("promotions")
    .select(PROMOTION_SELECT)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error || !data) return [];

  const now = new Date();
  return (data as unknown as PromotionRow[])
    .map(toPromotion)
    .filter((p) => isPromotionLive(p, now));
}

/** Flat set of every variant id that currently belongs to a live promotion. */
export function collectPromotionalVariantIds(promotions: Promotion[]): Set<string> {
  const ids = new Set<string>();
  for (const promotion of promotions) {
    for (const variantId of promotion.eligibleVariantIds) ids.add(variantId);
  }
  return ids;
}

/** The minimum shape the /promotions membership rule needs to inspect. */
export interface PromotionCandidate {
  variants: {
    id: string;
    priceAgorot: number;
    comparePriceAgorot: number | null;
  }[];
  dealEnabled: boolean;
  dealQuantity: number | null;
  dealPriceAgorot: number | null;
}

/**
 * The single rule that decides whether a product belongs on /promotions.
 *
 * A product qualifies while ANY of these holds, and drops off the moment the
 * last one stops:
 *   1. an available variant has a genuine sale price (compare price above price),
 *   2. the product has a valid legacy quantity deal, or
 *   3. an available variant belongs to a live group promotion.
 *
 * Callers pass only variants that are actually purchasable, so an unavailable
 * variant can never keep a product on the page.
 */
export function isPromotionalProduct(
  product: PromotionCandidate,
  liveVariantIds: ReadonlySet<string>
): boolean {
  const hasSalePrice = product.variants.some(
    (v) => v.comparePriceAgorot !== null && v.comparePriceAgorot > v.priceAgorot
  );

  const hasLegacyDeal =
    product.dealEnabled &&
    product.dealQuantity !== null &&
    product.dealQuantity > 0 &&
    product.dealPriceAgorot !== null;

  const hasGroupPromotion = product.variants.some((v) => liveVariantIds.has(v.id));

  return hasSalePrice || hasLegacyDeal || hasGroupPromotion;
}
