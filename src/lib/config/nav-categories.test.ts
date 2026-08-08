import { describe, expect, it } from "vitest";
import {
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

  it("exposes גלידות and פיצוחים as top-level categories", () => {
    const iceCreams = PARENT_CATEGORY_NAV.find((c) => c.slug === "ice-creams");
    const nuts = PARENT_CATEGORY_NAV.find((c) => c.slug === "nuts");

    expect(iceCreams).toBeDefined();
    expect(iceCreams!.label).toBe("גלידות");
    expect(iceCreams!.href).toBe("/ice-creams");

    expect(nuts).toBeDefined();
    expect(nuts!.label).toBe("פיצוחים");
    expect(nuts!.href).toBe("/nuts");
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
