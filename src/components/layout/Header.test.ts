import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Structural checks on the header (Navbar) cart pill. No jsdom/testing-library
 * in this project (vitest.config.ts, environment "node") — see
 * CartDrawer.test.ts for the same convention.
 *
 * The exact numeric regression for this bug (two independent quantity
 * promotions in the same cart) is pinned at the engine level in
 * src/lib/promotions/engine.test.ts — "כוסברה 4-for-10 + שמיר 4-for-10".
 * Both use the identical live `pricing` object from useCart(), so once the
 * source is wired to the same field, the displayed numbers cannot diverge.
 */
const headerSource = readFileSync("src/components/layout/Header.tsx", "utf8");
const drawerSource = readFileSync("src/components/layout/CartDrawer.tsx", "utf8");
const cartPageSource = readFileSync("src/app/(shop)/cart/page.tsx", "utf8");

describe("header (Navbar) cart pill total", () => {
  it("shows the discounted products total, not the undiscounted subtotalAgorot", () => {
    expect(headerSource).not.toMatch(/\bsubtotalAgorot\b/);
    expect(headerSource).toContain("formatPrice(pricing.chargedSubtotalAgorot)");
  });

  it("reads the SAME field the cart drawer's products-subtotal row reads, so they cannot structurally diverge", () => {
    expect(headerSource).toContain("pricing.chargedSubtotalAgorot");
    expect(drawerSource).toContain("pricing.chargedSubtotalAgorot");
    expect(cartPageSource).toContain("pricing.chargedSubtotalAgorot");
  });

  it("excludes delivery — the pill is products-only, matching the cart drawer's pre-delivery total", () => {
    // deliveryFeeAgorot only exists in checkout, never in the Header/cart
    // context that feeds this pill.
    expect(headerSource).not.toContain("deliveryFeeAgorot");
  });
});
