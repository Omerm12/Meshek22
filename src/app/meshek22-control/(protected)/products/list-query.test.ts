import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(
  join(process.cwd(), "src/app/meshek22-control/(protected)/products/page.tsx"),
  "utf8"
);

describe("products list query", () => {
  it("fetches the page and the exact total in ONE request (no separate HEAD count)", () => {
    expect(page).toContain('{ count: "exact" }');
    expect(page).not.toContain("head: true");
    expect((page.match(/\.from\("products"\)/g) ?? []).length).toBe(1);
  });

  it("keeps the exact total for pagination, never an estimate", () => {
    expect(page).not.toContain('"planned"');
    expect(page).not.toContain('"estimated"');
  });

  it("sends an out-of-range page (PGRST103 / 416) back to the first page instead of an error", () => {
    expect(page).toContain("PGRST103");
    expect(page).toContain("redirect(");
  });

  it("embeds only the variant COUNT, not variant rows", () => {
    expect(page).toContain("product_variants ( count )");
  });
});
