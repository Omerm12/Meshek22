import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Structural checks on the full /cart page. No jsdom/testing-library in this
 * project (vitest.config.ts, environment "node") — see
 * src/components/layout/CartDrawer.test.ts for the same convention.
 */
const source = readFileSync("src/app/(shop)/cart/page.tsx", "utf8");

describe("cart page totals", () => {
  it("shows the discounted products total, not the undiscounted subtotalAgorot", () => {
    expect(source).not.toMatch(/\bsubtotalAgorot\b/);
    // chargedSubtotal is a local alias of pricing.chargedSubtotalAgorot, used
    // for both the line-items breakdown row and the final total.
    expect(source).toContain("const chargedSubtotal  = pricing.chargedSubtotalAgorot;");
    const productsRowIdx = source.indexOf("מוצרים ({totalItems} פריטים)");
    expect(productsRowIdx).toBeGreaterThan(-1);
    expect(source.slice(productsRowIdx, productsRowIdx + 200)).toContain("formatPrice(chargedSubtotal)");
  });

  it("no longer shows a separate 'הנחת מבצעים' discount row", () => {
    expect(source).not.toContain("הנחת מבצעים");
    expect(source).not.toContain("pricing.discountAgorot > 0");
  });

  it("does not render the applied-promotions breakdown block", () => {
    expect(source).not.toContain("מבצעים שהופעלו");
    expect(source).not.toContain("pricing.appliedPromotions");
  });

  it("keeps the promotion-progress nudge (a different, still-wanted UI element)", () => {
    expect(source).toContain("pricing.progress.length > 0");
    expect(source).toContain("formatPromotionProgress(p)");
  });

  it("per-item price still reflects the discounted line total", () => {
    expect(source).toContain("line?.chargedTotalAgorot");
  });

  it("the free-delivery progress bar is based on the discounted total, unaffected by this fix", () => {
    expect(source).toContain("const remainingForFree = Math.max(0, MIN_FREE_DELIVERY - chargedSubtotal);");
  });
});
