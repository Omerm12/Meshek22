/**
 * Money utilities.
 * All prices are stored as integers (agorot = 1/100 of a shekel).
 * 100 agorot = 1 ₪
 */

/** Format agorot to display string e.g. 1990 → "19.90 ₪" */
export function formatPrice(agorot: number): string {
  const shekel = agorot / 100;
  return shekel.toLocaleString("he-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: shekel % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/** Format as compact price without decimals if whole number e.g. 1900 → "19 ₪" */
export function formatPriceCompact(agorot: number): string {
  const shekel = agorot / 100;
  if (shekel % 1 === 0) {
    return `${shekel.toLocaleString("he-IL")} ₪`;
  }
  return formatPrice(agorot);
}

/** Convert shekel float to agorot integer */
export function shekelToAgorot(shekel: number): number {
  return Math.round(shekel * 100);
}

/** Convert agorot integer to shekel float */
export function agorotToShekel(agorot: number): number {
  return agorot / 100;
}

/** Calculate discount percentage */
export function discountPercent(
  originalAgorot: number,
  saleAgorot: number
): number {
  if (originalAgorot <= 0) return 0;
  return Math.round(((originalAgorot - saleAgorot) / originalAgorot) * 100);
}
