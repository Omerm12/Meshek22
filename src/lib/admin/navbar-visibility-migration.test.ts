import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The show_in_navbar migration is plain SQL, so — like category-migration.test.ts
 * and more-from-the-farm-migration.test.ts before it — it cannot be executed here
 * without a database. These tests assert the properties that make it safe to run
 * against production: idempotent column add, a backfill that only ever turns the
 * flag ON for rows the current static navbar already shows (never off, never for
 * an inactive row), and no touching of any other table or column.
 */
const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260919120000_category_navbar_visibility.sql"),
  "utf8"
);

// Mirrors PARENT_CATEGORY_NAV in src/lib/config/nav-categories.ts at the time
// this migration was written — see nav-categories.test.ts for the live config.
const REQUIRED_BACKFILL_SLUGS = [
  "vegetables",
  "fruits",
  "more-from-the-farm",
  "regular-vegetables",
  "root-vegetables",
  "leafy-vegetables",
  "herbs",
  "special-vegetables",
  "cut-washed-vegetables",
  "vegetable-trays",
  "citrus-fruits",
  "regular-fruits",
  "special-fruits",
  "dried-fruits",
  "organic-fruits",
  "spices",
  "eggs",
  "nuts",
  "olive-oil",
  "crunchy-vegetables",
  "knives-and-peelers",
  "ice-creams",
];

describe("show_in_navbar migration: the column", () => {
  it("adds the column idempotently, NOT NULL, defaulting to FALSE", () => {
    expect(migration).toMatch(
      /ADD COLUMN IF NOT EXISTS show_in_navbar BOOLEAN NOT NULL DEFAULT FALSE/
    );
  });

  it("is safe to run more than once (no bare, unguarded ADD COLUMN)", () => {
    expect(migration).not.toMatch(/ADD COLUMN(?! IF NOT EXISTS)/);
  });
});

describe("show_in_navbar migration: backfill", () => {
  it("only ever sets the flag to TRUE, never FALSE — an admin's later choice is never overwritten back off by a re-run", () => {
    const setClauses = migration.match(/SET\s+show_in_navbar\s*=\s*\w+/g) ?? [];
    expect(setClauses.length).toBeGreaterThan(0);
    for (const clause of setClauses) {
      expect(clause).toMatch(/=\s*TRUE/i);
    }
  });

  it("restricts the backfill to active rows — never flags an inactive category into the navbar", () => {
    const updateIdx = migration.indexOf("UPDATE public.categories");
    const whereBlock = migration.slice(updateIdx, migration.indexOf(";", updateIdx));
    expect(whereBlock).toMatch(/is_active\s*=\s*TRUE/i);
  });

  it("backfills every slug currently shown in the static navbar, so production does not go empty on deploy", () => {
    for (const slug of REQUIRED_BACKFILL_SLUGS) {
      expect(migration).toContain(`'${slug}'`);
    }
  });

  it("backfills by slug membership only — no hardcoded category id anywhere", () => {
    expect(migration).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });

  it("touches only the categories table — never products, orders, or any other table", () => {
    const withoutComments = migration
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    const statements = withoutComments
      .split(";")
      .map((s) => s.trim())
      .filter((s) => /^(ALTER|UPDATE|INSERT|DELETE)\b/i.test(s));
    expect(statements.length).toBeGreaterThan(0);
    for (const statement of statements) {
      expect(statement).toContain("public.categories");
    }
  });

  it("never deletes or inserts a row — additive column plus an UPDATE only", () => {
    expect(migration).not.toMatch(/DELETE\s+FROM/i);
    expect(migration).not.toMatch(/INSERT\s+INTO/i);
  });
});
