import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The עוד מהמשק (more-from-the-farm) category-restructuring migration.
 *
 * Like category-migration.test.ts before it, this is plain SQL that cannot be
 * executed here without a database, so these tests assert the properties that
 * make it safe to run against production — reuse instead of duplication, no
 * product ever deleted or disconnected, no non-empty category ever deleted,
 * and idempotent re-runs — by reading the file.
 */
const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260906_more_from_the_farm_categories.sql"),
  "utf8"
);

const REQUIRED_CHILD_SLUGS = [
  "spices",
  "eggs",
  "nuts",
  "olive-oil",
  "crunchy-vegetables",
  "knives-and-peelers",
  "ice-creams",
];

describe("more-from-the-farm migration: the parent", () => {
  it("reuses the existing ice-creams-and-nuts row by renaming it, rather than creating a second parent", () => {
    expect(migration).toMatch(
      /UPDATE public\.categories[\s\S]*slug\s*=\s*'more-from-the-farm'[\s\S]*WHERE\s+slug = 'ice-creams-and-nuts'/
    );
  });

  it("only inserts a fresh parent row when neither slug already exists", () => {
    expect(migration).toMatch(
      /INSERT INTO public\.categories[\s\S]*'more-from-the-farm'[\s\S]*WHERE NOT EXISTS[\s\S]*slug IN \('more-from-the-farm', 'ice-creams-and-nuts'\)/
    );
  });

  it("keeps the parent at the top level and active", () => {
    expect(migration).toContain("'עוד מהמשק'");
    expect(migration).toContain("is_active   = TRUE");
    expect(migration).toContain("parent_id   = NULL");
  });
});

describe("more-from-the-farm migration: the seven children", () => {
  it("creates or reuses every required child slug", () => {
    for (const slug of REQUIRED_CHILD_SLUGS) {
      expect(migration).toContain(`'${slug}'`);
    }
  });

  it("guards every straightforward child insert so a re-run cannot create a duplicate slug", () => {
    // eggs is guarded differently (see the dedicated reuse test below): it
    // looks up any existing row by slug OR legacy name before deciding
    // whether to insert or update, rather than a plain NOT EXISTS guard.
    for (const slug of REQUIRED_CHILD_SLUGS.filter((s) => s !== "eggs")) {
      const re = new RegExp(`WHERE NOT EXISTS \\(SELECT 1 FROM public\\.categories WHERE slug = '${slug}'\\)`);
      expect(migration).toMatch(re);
    }
  });

  it("reparents every child onto the resolved parent id, not a hardcoded UUID", () => {
    // Every child block resolves v_parent_id from the categories table itself
    // rather than assuming a fixed id — required since the parent may have
    // been freshly inserted or reused from the renamed legacy row.
    const parentLookups = migration.match(
      /SELECT id INTO v_parent_id FROM public\.categories WHERE slug = 'more-from-the-farm'/g
    );
    expect(parentLookups?.length).toBeGreaterThanOrEqual(REQUIRED_CHILD_SLUGS.length);
  });

  it("sets the requested sort_order for each child (10..70, matching the required order)", () => {
    // Anchored on each numbered section header rather than the slug itself:
    // 'eggs' also appears earlier, inside the reuse lookup's WHERE clause,
    // well before its sort_order is ever set.
    const sectionOrder = [
      ["-- 2.1", 10],
      ["-- 2.2", 20],
      ["-- 2.3", 30],
      ["-- 2.4", 40],
      ["-- 2.5", 50],
      ["-- 2.6", 60],
      ["-- 2.7", 70],
    ] as const;

    for (const [header, order] of sectionOrder) {
      const idx = migration.indexOf(header);
      expect(idx).toBeGreaterThan(-1);
      const nextHeaderIdx = migration.indexOf("\n-- 2.", idx + header.length);
      const block = migration.slice(idx, nextHeaderIdx === -1 ? idx + 800 : nextHeaderIdx);
      expect(block).toContain(`sort_order = ${order}`);
    }
  });

  it("reuses a pre-existing eggs/dairy row by slug or Hebrew name instead of creating a duplicate", () => {
    expect(migration).toContain("slug IN ('eggs', 'beitsim') OR name = 'ביצים ומוצרי חלב'");
    // Reuse renames and reparents only — it must never touch description or
    // image_url, and it must never touch products.category_id. (The English
    // comment inside this block legitimately mentions "image_url" to say it is
    // left alone, so check for an assignment specifically, not the bare word.)
    const idx = migration.indexOf("-- 2.2 ביצים");
    const block = migration.slice(idx, migration.indexOf("-- 2.3"));
    expect(block).not.toMatch(/description\s*=/);
    expect(block).not.toMatch(/image_url\s*=/);
    expect(block).not.toMatch(/UPDATE\s+public\.products/i);
  });

  it("never guesses which merged ice-cream-or-nut product goes where", () => {
    // 20260808_001 already merged and deleted the separate ice-creams/nuts
    // rows, so there is nothing left to reuse for slugs 'nuts' or 'ice-creams'
    // — this migration must not attempt to move any product into them.
    expect(migration).not.toMatch(/UPDATE\s+public\.products/i);
  });
});

describe("more-from-the-farm migration: safety", () => {
  it("never deletes a product", () => {
    expect(migration).not.toMatch(/DELETE\s+FROM\s+public\.products/i);
  });

  it("never deletes a category", () => {
    expect(migration).not.toMatch(/DELETE\s+FROM\s+public\.categories/i);
  });

  it("never writes a null category_id", () => {
    expect(migration).not.toMatch(/category_id\s*=\s*NULL/i);
  });

  it("leaves the vegetable and fruit hierarchy alone", () => {
    expect(migration).not.toContain("'vegetables'");
    expect(migration).not.toContain("'fruits'");
  });

  it("adds parent_id/is_featured and their constraints idempotently, matching the existing convention", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS parent_id");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS is_featured");
    expect(migration).toMatch(/IF NOT EXISTS \([\s\S]*pg_constraint[\s\S]*categories_parent_id_fkey/);
  });

  it("verifies the end state and fails loudly rather than half-migrating", () => {
    expect(migration).toContain("expected exactly one active top-level more-from-the-farm category");
    expect(migration).toContain("expected all 7 more-from-the-farm children to exist");
    expect(migration).toContain("ice-creams-and-nuts should have been renamed");
  });
});
