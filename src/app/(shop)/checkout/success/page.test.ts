import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Structural checks on the order-confirmation page. No jsdom/testing-library
 * in this project (vitest.config.ts, environment "node") — see
 * src/components/layout/CartDrawer.test.ts for the same convention.
 *
 * Unlike the cart/checkout UI (which reads a live `pricing` object), this
 * page reads the already-persisted order row, so "discounted subtotal" here
 * is order.subtotal_agorot - order.discount_agorot rather than a
 * chargedSubtotalAgorot field — the order record itself is untouched.
 */
const source = readFileSync("src/app/(shop)/checkout/success/page.tsx", "utf8");

describe("order confirmation totals", () => {
  it("shows the discounted products total, not the raw stored subtotal_agorot", () => {
    expect(source).not.toContain("formatPrice(order.subtotal_agorot)");
    expect(source).toContain("formatPrice(order.subtotal_agorot - order.discount_agorot)");
  });

  it("no longer shows a separate 'הנחת מבצעים' discount row", () => {
    expect(source).not.toContain("הנחת מבצעים");
  });

  it("the grand total still comes straight from the stored order total (delivery included)", () => {
    expect(source).toContain("formatPrice(order.total_agorot)");
  });
});
