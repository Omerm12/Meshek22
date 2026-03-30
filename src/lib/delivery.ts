import { findSettlement } from "@/lib/data/settlements";

export interface DeliveryZoneData {
  slug: string;
  name: string;
  baseFeeAgorot: number; // 0 = free always
  freeThrsholdAgorot: number | null; // null = no free delivery
  minOrderAgorot: number;
  estimatedDays: string; // display string
}

// Mirrors delivery_zones table rows (static fallback for client use)
export const DELIVERY_ZONES: Record<string, DeliveryZoneData> = {
  "zone-center": {
    slug: "zone-center",
    name: "גוש דן מרכזי",
    baseFeeAgorot: 0,
    freeThrsholdAgorot: 15000, // free from 150₪
    minOrderAgorot: 5000,       // min 50₪
    estimatedDays: "עד 24 שעות",
  },
  "zone-gush-dan": {
    slug: "zone-gush-dan",
    name: "גוש דן רחב",
    baseFeeAgorot: 1500,        // 15₪
    freeThrsholdAgorot: 20000,  // free from 200₪
    minOrderAgorot: 7500,       // min 75₪
    estimatedDays: "1–2 ימי עסקים",
  },
  "zone-central": {
    slug: "zone-central",
    name: "מרכז הארץ",
    baseFeeAgorot: 2500,        // 25₪
    freeThrsholdAgorot: 25000,  // free from 250₪
    minOrderAgorot: 10000,      // min 100₪
    estimatedDays: "1–2 ימי עסקים",
  },
  "zone-jerusalem": {
    slug: "zone-jerusalem",
    name: "ירושלים והסביבה",
    baseFeeAgorot: 3500,        // 35₪
    freeThrsholdAgorot: 30000,  // free from 300₪
    minOrderAgorot: 10000,      // min 100₪
    estimatedDays: "2–3 ימי עסקים",
  },
  "zone-north": {
    slug: "zone-north",
    name: "צפון",
    baseFeeAgorot: 3500,        // 35₪
    freeThrsholdAgorot: 30000,  // free from 300₪
    minOrderAgorot: 10000,      // min 100₪
    estimatedDays: "2–3 ימי עסקים",
  },
  "zone-south": {
    slug: "zone-south",
    name: "דרום",
    baseFeeAgorot: 4500,        // 45₪
    freeThrsholdAgorot: null,   // no free delivery
    minOrderAgorot: 15000,      // min 150₪
    estimatedDays: "2–4 ימי עסקים",
  },
};

export interface DeliveryQuote {
  zone: DeliveryZoneData;
  feeAgorot: number;         // actual fee after free-delivery check
  isFree: boolean;
  remainingForFree: number;  // agorot needed to unlock free delivery (0 if already free or not available)
  meetsMinimum: boolean;
  shortfallAgorot: number;   // how much more needed to meet minimum (0 if met)
}

/**
 * Calculate delivery quote for a given zone and cart subtotal.
 */
export function getDeliveryQuote(zoneSlug: string, subtotalAgorot: number): DeliveryQuote {
  const zone = DELIVERY_ZONES[zoneSlug] ?? DELIVERY_ZONES["zone-gush-dan"];

  const isFree =
    zone.freeThrsholdAgorot !== null && subtotalAgorot >= zone.freeThrsholdAgorot;

  const feeAgorot = isFree ? 0 : zone.baseFeeAgorot;

  const remainingForFree =
    zone.freeThrsholdAgorot !== null && !isFree
      ? Math.max(0, zone.freeThrsholdAgorot - subtotalAgorot)
      : 0;

  const meetsMinimum = subtotalAgorot >= zone.minOrderAgorot;
  const shortfallAgorot = meetsMinimum ? 0 : zone.minOrderAgorot - subtotalAgorot;

  return { zone, feeAgorot, isFree, remainingForFree, meetsMinimum, shortfallAgorot };
}

/**
 * Look up a zone by city/settlement name.
 * Returns the zone data or undefined if city not found.
 */
export function findZoneByCity(city: string): DeliveryZoneData | undefined {
  const settlement = findSettlement(city);
  if (!settlement) return undefined;
  return DELIVERY_ZONES[settlement.zone];
}
