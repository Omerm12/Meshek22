import { describe, expect, it } from "vitest";
import {
  MERGED_CATEGORY_REDIRECTS,
  MORE_FROM_THE_FARM_HREF,
  MORE_FROM_THE_FARM_SLUG,
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

const REQUIRED_CHILD_ORDER = [
  { label: "תבלינים",         slug: "spices" },
  { label: "ביצים",           slug: "eggs" },
  { label: "פיצוחים",         slug: "nuts" },
  { label: "שמן זית",         slug: "olive-oil" },
  { label: "ירקות קרנצ'ים",  slug: "crunchy-vegetables" },
  { label: "סכינים ומקלפים",  slug: "knives-and-peelers" },
  { label: "גלידות",          slug: "ice-creams" },
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

  it("exposes exactly one עוד מהמשק entry, replacing גלידות ופיצוחים", () => {
    const entries = PARENT_CATEGORY_NAV.filter((c) => c.slug === MORE_FROM_THE_FARM_SLUG);

    expect(entries).toHaveLength(1);
    expect(entries[0].label).toBe("עוד מהמשק");
    expect(entries[0].href).toBe("/more-from-the-farm");

    expect(allNavLabels).not.toContain("גלידות ופיצוחים");
    expect(allNavHrefs).not.toContain("/ice-creams-and-nuts");
  });

  it("lists all seven required child categories, in the requested order", () => {
    const entry = PARENT_CATEGORY_NAV.find((c) => c.slug === MORE_FROM_THE_FARM_SLUG);
    expect(entry).toBeDefined();

    expect(entry!.children.map((c) => ({ label: c.label, slug: c.slug }))).toEqual(
      REQUIRED_CHILD_ORDER
    );
  });

  it("gives every child an href on the new parent page using the ?sub= pattern", () => {
    const entry = PARENT_CATEGORY_NAV.find((c) => c.slug === MORE_FROM_THE_FARM_SLUG)!;
    for (const child of entry.children) {
      expect(child.href).toBe(`${MORE_FROM_THE_FARM_HREF}?sub=${child.slug}`);
    }
  });

  it("no longer offers a standalone customer-facing גלידות/פיצוחים link outside the parent", () => {
    // Neither as a top-level category…
    expect(PARENT_CATEGORY_NAV.some((c) => c.slug === "ice-creams")).toBe(false);
    expect(PARENT_CATEGORY_NAV.some((c) => c.slug === "nuts")).toBe(false);
    // …nor as a link to either retired top-level route.
    expect(allNavHrefs).not.toContain("/ice-creams");
    expect(allNavHrefs).not.toContain("/nuts");
  });

  it("maps all three retired routes to the new עוד מהמשק page or subcategory", () => {
    expect(MERGED_CATEGORY_REDIRECTS["/ice-creams-and-nuts"]).toBe("/more-from-the-farm");
    expect(MERGED_CATEGORY_REDIRECTS["/ice-creams"]).toBe("/more-from-the-farm?sub=ice-creams");
    expect(MERGED_CATEGORY_REDIRECTS["/nuts"]).toBe("/more-from-the-farm?sub=nuts");
  });

  it("keeps ירקות and פירות with their subcategories, unchanged", () => {
    const vegetables = PARENT_CATEGORY_NAV.find((c) => c.slug === "vegetables");
    const fruits = PARENT_CATEGORY_NAV.find((c) => c.slug === "fruits");

    expect(vegetables?.href).toBe("/vegetables");
    expect(fruits?.href).toBe("/fruits");
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

  it("does not duplicate any nav href", () => {
    expect(new Set(allNavHrefs).size).toBe(allNavHrefs.length);
  });

  it("uses only in-app absolute paths", () => {
    for (const href of allNavHrefs) {
      expect(href.startsWith("/")).toBe(true);
    }
  });
});
