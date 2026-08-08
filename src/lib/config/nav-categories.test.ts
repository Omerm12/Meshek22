import { describe, expect, it } from "vitest";
import {
  ICE_CREAMS_AND_NUTS_SLUG,
  MERGED_CATEGORY_REDIRECTS,
  PARENT_CATEGORY_NAV,
  SIMPLE_NAV_LINKS,
} from "@/lib/config/nav-categories";

/**
 * The header and the mobile menu both render exclusively from these two arrays,
 * so asserting on them covers desktop and mobile navigation at once.
 */
const allNavHrefs = [
  ...PARENT_CATEGORY_NAV.map((c) => c.href),
  ...PARENT_CATEGORY_NAV.flatMap((c) => c.children.map((ch) => ch.href)),
  ...SIMPLE_NAV_LINKS.map((l) => l.href),
];

const allNavLabels = [
  ...PARENT_CATEGORY_NAV.map((c) => c.label),
  ...PARENT_CATEGORY_NAV.flatMap((c) => c.children.map((ch) => ch.label)),
  ...SIMPLE_NAV_LINKS.map((l) => l.label),
];

describe("storefront navigation", () => {
  it('does not offer "כל המוצרים" anywhere', () => {
    expect(allNavLabels).not.toContain("כל המוצרים");
  });

  it("never links to the retired /products route", () => {
    for (const href of allNavHrefs) {
      expect(href.startsWith("/products")).toBe(false);
    }
  });

  it("exposes exactly one combined גלידות ופיצוחים entry", () => {
    const combined = PARENT_CATEGORY_NAV.filter(
      (c) => c.slug === ICE_CREAMS_AND_NUTS_SLUG
    );

    expect(combined).toHaveLength(1);
    expect(combined[0].label).toBe("גלידות ופיצוחים");
    expect(combined[0].href).toBe("/ice-creams-and-nuts");
  });

  it("offers no separate customer-facing גלידות or פיצוחים entry", () => {
    // Neither as a top-level category…
    expect(PARENT_CATEGORY_NAV.some((c) => c.slug === "ice-creams")).toBe(false);
    expect(PARENT_CATEGORY_NAV.some((c) => c.slug === "nuts")).toBe(false);

    // …nor as a standalone label anywhere in the menu.
    expect(allNavLabels).not.toContain("גלידות");
    expect(allNavLabels).not.toContain("פיצוחים");

    // …nor as a link to either retired route.
    expect(allNavHrefs).not.toContain("/ice-creams");
    expect(allNavHrefs).not.toContain("/nuts");
  });

  it("renders the combined entry as a single link with no dropdown", () => {
    const combined = PARENT_CATEGORY_NAV.find(
      (c) => c.slug === ICE_CREAMS_AND_NUTS_SLUG
    );
    // The two children are database-only, for admin product assignment. They
    // must not surface as extra navigation links.
    expect(combined!.children).toEqual([]);
  });

  it("maps both retired routes to the combined page", () => {
    expect(MERGED_CATEGORY_REDIRECTS["/ice-creams"]).toBe("/ice-creams-and-nuts");
    expect(MERGED_CATEGORY_REDIRECTS["/nuts"]).toBe("/ice-creams-and-nuts");
  });

  it("keeps ירקות and פירות with their subcategories", () => {
    const vegetables = PARENT_CATEGORY_NAV.find((c) => c.slug === "vegetables");
    const fruits = PARENT_CATEGORY_NAV.find((c) => c.slug === "fruits");

    expect(vegetables?.children.length).toBeGreaterThan(0);
    expect(fruits?.children.length).toBeGreaterThan(0);
  });

  it("shows מבצעים in the navigation", () => {
    const promotions = SIMPLE_NAV_LINKS.find((l) => l.href === "/promotions");
    expect(promotions).toBeDefined();
    expect(promotions!.label).toBe("מבצעים");
  });

  it("exposes no administrator link", () => {
    for (const href of allNavHrefs) {
      expect(href).not.toContain("admin");
      expect(href).not.toContain("meshek22-control");
    }
  });

  it("keeps the desktop bar to a workable number of top-level entries", () => {
    // Six entries fit at 768px with the tightened padding in Header.tsx. Adding
    // more without revisiting that layout would overflow the bar.
    expect(PARENT_CATEGORY_NAV.length + SIMPLE_NAV_LINKS.length).toBeLessThanOrEqual(7);
  });

  it("uses only in-app absolute paths", () => {
    for (const href of allNavHrefs) {
      expect(href.startsWith("/")).toBe(true);
    }
  });
});
