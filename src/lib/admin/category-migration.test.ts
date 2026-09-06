import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PARENT_CATEGORY_NAV, MERGED_CATEGORY_REDIRECTS, MORE_FROM_THE_FARM_SLUG } from "@/lib/config/nav-categories";

/**
 * The combined-category migration is plain SQL, so it cannot be executed here
 * without a database. These tests assert the properties that make it safe —
 * the ones that would silently destroy data if they regressed — by reading the
 * file, plus the application-side guarantees around it.
 */
const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260808_001_ice_cream_nuts_categories.sql"),
  "utf8"
);

describe("combined category migration", () => {
  it("creates exactly one combined category, at top level and active", () => {
    expect(migration).toContain("'ice-creams-and-nuts'");
    expect(migration).toContain("'גלידות ופיצוחים'");
    // Guarded insert — re-running must not add a second row.
    expect(migration).toMatch(/WHERE NOT EXISTS[\s\S]*slug = 'ice-creams-and-nuts'/);
  });

  it("reassigns products off the legacy categories before deleting them", () => {
    const updateAt = migration.indexOf("UPDATE public.products");
    const deleteAt = migration.indexOf("DELETE FROM public.categories");

    expect(updateAt).toBeGreaterThan(-1);
    expect(deleteAt).toBeGreaterThan(-1);
    // Order matters: deleting first would violate the FK or orphan products.
    expect(updateAt).toBeLessThan(deleteAt);
    expect(migration).toContain("SET    category_id = v_combined_id");
  });

  it("refuses to delete a legacy category that still has products", () => {
    expect(migration).toContain("refusing to delete legacy categories");
    expect(migration).toMatch(/IF EXISTS \(SELECT 1 FROM public\.products WHERE category_id = ANY\(v_legacy_ids\)\)/);
  });

  it("re-parents any subcategory of a legacy row instead of losing it", () => {
    expect(migration).toContain("SET    parent_id = v_combined_id");
  });

  it("removes the legacy rows so they cannot be selected in the admin", () => {
    expect(migration).toContain("DELETE FROM public.categories WHERE id = ANY(v_legacy_ids)");
  });

  it("verifies the end state and fails loudly rather than half-migrating", () => {
    expect(migration).toContain("expected exactly one active top-level ice-creams-and-nuts category");
    expect(migration).toContain("legacy ice-creams/nuts categories still present");
  });

  it("is a no-op when there is nothing to migrate", () => {
    expect(migration).toContain("no legacy ice-creams/nuts categories present");
  });

  it("adds required columns and constraints idempotently", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS is_featured");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS parent_id");
    expect(migration).toContain("categories_parent_id_fkey");
    expect(migration).toContain("categories_no_self_parent_chk");
    // Guarded so a second run does not error on an existing constraint.
    expect(migration).toMatch(/IF NOT EXISTS \([\s\S]*pg_constraint[\s\S]*categories_parent_id_fkey/);
  });

  it("never deletes a product", () => {
    expect(migration).not.toMatch(/DELETE\s+FROM\s+public\.products/i);
  });

  it("leaves the fruit and vegetable hierarchy alone", () => {
    // It must not touch categories by any slug other than the three involved.
    expect(migration).not.toContain("'vegetables'");
    expect(migration).not.toContain("'fruits'");
  });
});

describe("combined category in the application (as it stood right after 20260808_001)", () => {
  // 20260906_more_from_the_farm_categories.sql (see
  // more-from-the-farm-migration.test.ts) later renamed and reparented this
  // same row into עוד מהמשק with real children. These assertions describe the
  // interim state this migration alone produced, and are kept as regression
  // coverage for that file, which has not changed.
  it("the row this migration created is the same one עוד מהמשק reuses", () => {
    const entries = PARENT_CATEGORY_NAV.filter((c) => c.slug === MORE_FROM_THE_FARM_SLUG);
    expect(entries).toHaveLength(1);
    expect(entries[0].label).toBe("עוד מהמשק");
    // Now populated with the seven required children — no longer empty.
    expect(entries[0].children.length).toBe(7);
  });

  it("ice-creams and nuts are not separate top-level categories", () => {
    const slugs = PARENT_CATEGORY_NAV.map((c) => c.slug);
    expect(slugs).not.toContain("ice-creams");
    expect(slugs).not.toContain("nuts");
  });

  it("routes both legacy slugs to their child tab on the new parent page", () => {
    expect(MERGED_CATEGORY_REDIRECTS["/ice-creams"]).toBe("/more-from-the-farm?sub=ice-creams");
    expect(MERGED_CATEGORY_REDIRECTS["/nuts"]).toBe("/more-from-the-farm?sub=nuts");
  });
});
