import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Structural checks on the cart drawer. No jsdom/testing-library in this
 * project (vitest.config.ts, environment "node"), so — consistent with the
 * rest of the suite — these assert on the component source. See
 * src/lib/promotions/engine.test.ts's "regression: banana + coriander"
 * test for proof that chargedSubtotalAgorot itself is the correct number.
 */
const source = readFileSync("src/components/layout/CartDrawer.tsx", "utf8");

describe("cart drawer totals", () => {
  it("shows the discounted products total, not the undiscounted subtotalAgorot", () => {
    expect(source).not.toContain("formatPrice(subtotalAgorot)");
    expect(source).not.toMatch(/\bsubtotalAgorot\b/);
    expect(source).toContain("formatPrice(pricing.chargedSubtotalAgorot)");
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
    expect(source).toContain("linePricing?.chargedTotalAgorot");
  });
});
