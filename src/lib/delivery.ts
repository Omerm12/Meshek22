/**
 * Delivery fee calculation utilities.
 *
 * Zone data comes exclusively from the database — there are no hardcoded
 * zone slugs, names, or fee amounts here. This file only contains pure
 * calculation logic that accepts a DB zone row and returns a quote.
 */

/** Subset of delivery_zones columns needed for fee calculation. */
export interface DeliveryZone {
  id: string;
  name: string;
  delivery_fee_agorot: number;
  free_delivery_threshold_agorot: number | null;
  min_order_agorot: number;
  estimated_delivery_hours: number | null;
}

export interface DeliveryQuote {
  zone: DeliveryZone;
  feeAgorot: number;
  isFree: boolean;
  /** Agorot remaining to unlock free delivery. 0 if already free or not available. */
  remainingForFree: number;
  meetsMinimum: boolean;
  /** Agorot still needed to meet the minimum. 0 if met. */
  shortfallAgorot: number;
  /** Formatted Hebrew delivery time label derived from estimated_delivery_hours. */
  estimatedLabel: string;
}

/** Format delivery hours into a Hebrew display string. */
function formatEstimatedDelivery(hours: number | null): string {
  if (!hours || hours <= 0) return "עד 3 ימי עסקים";
  if (hours <= 24)          return "עד 24 שעות";
  if (hours <= 48)          return "1–2 ימי עסקים";
  if (hours <= 72)          return "2–3 ימי עסקים";
  return "עד 4 ימי עסקים";
}

/**
 * Calculate a delivery quote for a given zone and cart subtotal.
 * All inputs come from the database — no hardcoded zone data.
 */
export function getDeliveryQuote(
  zone: DeliveryZone,
  subtotalAgorot: number
): DeliveryQuote {
  const isFree =
    zone.free_delivery_threshold_agorot !== null &&
    subtotalAgorot >= zone.free_delivery_threshold_agorot;

  const feeAgorot = isFree ? 0 : zone.delivery_fee_agorot;

  const remainingForFree =
    zone.free_delivery_threshold_agorot !== null && !isFree
      ? Math.max(0, zone.free_delivery_threshold_agorot - subtotalAgorot)
      : 0;

  const meetsMinimum = subtotalAgorot >= zone.min_order_agorot;
  const shortfallAgorot = meetsMinimum ? 0 : zone.min_order_agorot - subtotalAgorot;

  return {
    zone,
    feeAgorot,
    isFree,
    remainingForFree,
    meetsMinimum,
    shortfallAgorot,
    estimatedLabel: formatEstimatedDelivery(zone.estimated_delivery_hours),
  };
}
