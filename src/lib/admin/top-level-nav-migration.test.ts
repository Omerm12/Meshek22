import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260919130000_category_top_level_nav_promotion.sql",
  "utf8"
);

describe("show_as_top_level_nav migration", () => {
  it("adds the column idempotently, NOT NULL, defaulting to FALSE", () => {
    expect(migration).toMatch(
      /ADD COLUMN IF NOT EXISTS show_as_top_level_nav BOOLEAN NOT NULL DEFAULT FALSE/
    );
  });

  it("is safe to run more than once (no bare, unguarded ADD COLUMN)", () => {
    expect(migration).not.toMatch(/ADD COLUMN(?! IF NOT EXISTS)/);
  });

  it("does not automatically promote any existing category — no UPDATE statement at all", () => {
    expect(migration).not.toMatch(/UPDATE\s+public\.categories/i);
  });

  it("never touches parent_id, names, slugs, is_active, show_in_navbar or sort_order", () => {
    // Explanatory comments legitimately mention these columns in prose (e.g.
    // "is_active = false hides it..."); only the executable SQL matters here.
    const sql = migration
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");

    expect(sql).not.toMatch(/\bparent_id\s*=/);
    expect(sql).not.toMatch(/\bis_active\s*=/);
    expect(sql).not.toMatch(/\bshow_in_navbar\s*=/);
    expect(sql).not.toMatch(/\bsort_order\s*=/);
  });

  it("touches only the categories table", () => {
    const statements = migration
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .split(";")
      .map((s) => s.trim())
      .filter((s) => /^(ALTER|UPDATE|INSERT|DELETE)\b/i.test(s));

    expect(statements.length).toBeGreaterThan(0);
    for (const statement of statements) {
      expect(statement).toContain("public.categories");
    }
  });

  it("never deletes or inserts a row — additive column only", () => {
    expect(migration).not.toMatch(/DELETE\s+FROM/i);
    expect(migration).not.toMatch(/INSERT\s+INTO/i);
  });

  it("is timestamped after the show_in_navbar migration it builds on", () => {
    const files = readdirSync("supabase/migrations")
      .filter((f) => f.endsWith(".sql") && /^\d{14}_/.test(f))
      .sort();
    const navbarIdx = files.indexOf("20260919120000_category_navbar_visibility.sql");
    const topLevelIdx = files.indexOf("20260919130000_category_top_level_nav_promotion.sql");
    expect(navbarIdx).toBeGreaterThan(-1);
    expect(topLevelIdx).toBeGreaterThan(navbarIdx);
  });
});
