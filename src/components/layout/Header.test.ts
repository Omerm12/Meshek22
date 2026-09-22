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
const shopLayoutSource = readFileSync("src/app/(shop)/layout.tsx", "utf8");
const homePageSource = readFileSync("src/app/page.tsx", "utf8");

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

describe("navbar category tree is dynamic, not the static PARENT_CATEGORY_NAV config", () => {
  it("Header no longer imports the static PARENT_CATEGORY_NAV list", () => {
    expect(headerSource).not.toContain("PARENT_CATEGORY_NAV");
  });

  it("Header renders both desktop and mobile menus from the same categoryTree prop", () => {
    expect(headerSource).toContain("categoryTree: NavCategoryNode[]");
    expect(headerSource).toContain("export function Header({ categoryTree }: HeaderProps)");
    // Both the desktop <nav> and the mobile panel map the same prop — not two
    // independent data sources that could drift apart.
    const desktopIdx = headerSource.indexOf("categoryTree.map");
    const mobileIdx = headerSource.indexOf("categoryTree.map", desktopIdx + 1);
    expect(desktopIdx).toBeGreaterThan(-1);
    expect(mobileIdx).toBeGreaterThan(-1);
  });

  it("SIMPLE_NAV_LINKS (non-category static links) is still imported — only the category list became dynamic", () => {
    expect(headerSource).toContain("SIMPLE_NAV_LINKS");
  });

  it("the (shop) layout fetches the tree once and passes it into Header — every shop page shares one fetch", () => {
    expect(shopLayoutSource).toContain("fetchNavbarCategoryTree");
    expect(shopLayoutSource).toContain("<Header categoryTree={categoryTree} />");
  });

  it("the homepage (outside the (shop) route group) fetches its own tree the same way, not a second data source", () => {
    expect(homePageSource).toContain("fetchNavbarCategoryTree");
    expect(homePageSource).toContain("<Header categoryTree={categoryTree} />");
  });
});

describe("navbar freshness check for already-open tabs", () => {
  // Regression coverage for: an admin reorders a category, but a customer
  // tab that already rendered the homepage (a static/ISR route — see
  // next.config.ts's unmodified default staleTimes.static = 300s) keeps
  // showing the old order from its client-side Router Cache until something
  // client-side asks for fresh data. revalidatePath/updateTag (server side)
  // cannot reach into that tab on their own.

  it("polls the shared version endpoint, not a new per-visitor Supabase query", () => {
    expect(headerSource).toContain('fetch("/api/nav/version"');
  });

  it("bypasses the browser HTTP cache on each check, so the throttle window is the only staleness source", () => {
    expect(headerSource).toContain('cache: "no-store"');
  });

  it("throttles checks with a module-level (not component-state) timestamp, so it survives Header remounting across layouts", () => {
    expect(headerSource).toMatch(/^let lastNavFreshnessCheckAt = 0;/m);
    expect(headerSource).toContain("NAV_FRESHNESS_CHECK_INTERVAL_MS = 60_000");
    expect(headerSource).toContain(
      "now - lastNavFreshnessCheckAt < NAV_FRESHNESS_CHECK_INTERVAL_MS"
    );
  });

  it("skips only the tab's very first mount, using a module-level flag — a component ref would reset (and wrongly re-skip) every time Header remounts crossing the home/(shop) layout boundary", () => {
    expect(headerSource).toMatch(/^let hasPassedFirstNavMount = false;/m);
    // Must NOT be component state/ref — that was the actual bug: a per-mount
    // ref treats every home<->category crossing as a fresh "first mount"
    // (Header lives in two different places in the tree: page.tsx for '/'
    // and (shop)/layout.tsx for every other page) and so never fires the
    // check on exactly the navigation this feature is for.
    expect(headerSource).not.toContain("skippedFirstPathCheck");
  });

  it("only updates the navbar via router.refresh() when the fetched version actually differs — never unconditionally", () => {
    const refreshIdx = headerSource.indexOf("router.refresh()");
    expect(refreshIdx).toBeGreaterThan(-1);
    const guardIdx = headerSource.indexOf("data.version !== currentVersionRef.current");
    expect(guardIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(refreshIdx);
  });

  it("never calls router.push, router.replace, window.location, or full reloads to apply a refresh — cart/checkout state must survive", () => {
    expect(headerSource).not.toContain("window.location.reload");
    expect(headerSource).not.toContain("router.push(pathname");
    expect(headerSource).not.toMatch(/localStorage\.(clear|removeItem)/);
  });

  it("does not run the freshness check while on the checkout route", () => {
    expect(headerSource).toContain('pathname.startsWith("/checkout")');
  });

  it("does not poll on an interval — only reacts to navigation (pathname) and tab-visibility/focus events", () => {
    expect(headerSource).not.toMatch(/setInterval/);
    expect(headerSource).toContain("visibilitychange");
    expect(headerSource).toContain("addEventListener(\"focus\"");
  });
});
