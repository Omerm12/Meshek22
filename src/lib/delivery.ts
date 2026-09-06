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
  min_order_agorot: number | null;
  estimated_delivery_hours: number | null;
  /** Recurring Hebrew weekday names (e.g. "ראשון") or specific "YYYY-MM-DD" dates, as configured in the admin panel. */
  delivery_days?: string[] | null;
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

/** Normal week order, Sunday through Saturday — matches DELIVERY_DAYS_OPTIONS in the admin form. */
const WEEKDAY_ORDER = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"] as const;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" → "DD/MM/YYYY" (Israeli date format). */
function formatIsraeliDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Human-readable Hebrew list of a zone's delivery days, e.g. "ראשון, שלישי וחמישי".
 *
 * Recurring weekday names are sorted into normal week order regardless of the
 * order they were saved in. Anything else is treated as a specific calendar
 * date and rendered in Israeli format, kept after the weekdays. Returns null
 * when there is nothing configured, so callers can omit the line entirely
 * rather than showing an empty or invented value.
 */
export function formatDeliveryDays(days: string[] | null | undefined): string | null {
  if (!days || days.length === 0) return null;

  const weekdaySet = new Set<string>(days);
  const weekdays = WEEKDAY_ORDER.filter((d) => weekdaySet.has(d));
  const other = days
    .filter((d) => !(WEEKDAY_ORDER as readonly string[]).includes(d))
    .map((d) => (ISO_DATE_RE.test(d) ? formatIsraeliDate(d) : d));

  const ordered = [...weekdays, ...other];
  if (ordered.length === 0) return null;
  if (ordered.length === 1) return ordered[0];
  return `${ordered.slice(0, -1).join(", ")} ו${ordered[ordered.length - 1]}`;
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

  const meetsMinimum = zone.min_order_agorot === null || subtotalAgorot >= zone.min_order_agorot;
  const shortfallAgorot = meetsMinimum ? 0 : zone.min_order_agorot! - subtotalAgorot;

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
