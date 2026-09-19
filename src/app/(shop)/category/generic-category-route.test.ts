import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The generic /category/[slug] parent page — the destination for any active
 * top-level category an admin creates that isn't one of the three dedicated
 * pages (vegetables/fruits/more-from-the-farm). Two layers of coverage:
 *
 *   1. A real, executed test of the redirect branch (mocking next/navigation
 *      only, the same technique combined-category.test.ts uses for the
 *      legacy /ice-creams etc. redirects) — this branch never touches
 *      Supabase, so it is safe to run for real.
 *   2. Structural checks on the non-redirect branch, which does call
 *      fetchParentCategoryPageData() against Supabase — consistent with how
 *      every other page-level test in this repo (Header.test.ts, cart/page.test.ts,
 *      admin-mutations.test.ts) avoids executing Supabase-backed rendering and
 *      instead asserts on source.
 */
const { permanentRedirect } = vi.hoisted(() => ({
  permanentRedirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("next/navigation", () => ({ permanentRedirect }));

import GenericParentCategoryPage from "@/app/(shop)/category/[slug]/page";

const pageSource = readFileSync("src/app/(shop)/category/[slug]/page.tsx", "utf8");
const shellSource = readFileSync("src/components/shop/ParentCategoryShell.tsx", "utf8");

beforeEach(() => {
  permanentRedirect.mockClear();
});

describe("generic /category/[slug] page: dedicated-slug redirect", () => {
  it("redirects vegetables to its dedicated route, never reaching the Supabase-backed data loader", async () => {
    await expect(
      GenericParentCategoryPage({
        params: Promise.resolve({ slug: "vegetables" }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow(/NEXT_REDIRECT:\/vegetables/);
    expect(permanentRedirect).toHaveBeenCalledWith("/vegetables");
  });

  it("redirects fruits and more-from-the-farm the same way", async () => {
    await expect(
      GenericParentCategoryPage({
        params: Promise.resolve({ slug: "fruits" }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow(/NEXT_REDIRECT:\/fruits/);

    permanentRedirect.mockClear();

    await expect(
      GenericParentCategoryPage({
        params: Promise.resolve({ slug: "more-from-the-farm" }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow(/NEXT_REDIRECT:\/more-from-the-farm/);
  });

  it("uses permanentRedirect (308), matching the retired-route convention, not a temporary redirect", () => {
    expect(pageSource).toContain("permanentRedirect(dedicatedHref)");
    // Only permanentRedirect is imported from next/navigation — no plain
    // redirect() (307) available to call by mistake.
    expect(pageSource).toMatch(/import\s*\{\s*permanentRedirect\s*\}\s*from\s*"next\/navigation"/);
  });
});

describe("generic /category/[slug] page: any other slug renders the shared shell", () => {
  it("resolves the parent generically by slug via fetchParentCategoryPageData — no hardcoded slug allowlist", () => {
    expect(pageSource).toContain("fetchParentCategoryPageData(slug, sub ?? null)");
  });

  it("passes basePath so subcategory links and the breadcrumb point back at /category/<slug>, not a bare /<slug>", () => {
    expect(pageSource).toContain("basePath={`/category/${slug}`}");
  });

  it("reuses ParentCategoryShell — the exact component vegetables/fruits/more-from-the-farm already use", () => {
    expect(pageSource).toContain("<ParentCategoryShell");
  });

  it("resolves a hero generically (getCategoryHero already falls back for an unknown slug)", () => {
    expect(pageSource).toContain("getCategoryHero(slug)");
  });
});

describe("ParentCategoryShell: basePath is backward compatible", () => {
  it("defaults to /<parentSlug> when basePath is omitted, so the three dedicated pages are unaffected", () => {
    expect(shellSource).toContain("const resolvedBasePath      = basePath ?? `/${parentSlug}`;");
  });

  it("both the subcategory tabs and the breadcrumb use the resolved base path, not a raw /<parentSlug> interpolation", () => {
    expect(shellSource).not.toMatch(/href=\{`\/\$\{parentSlug\}/);
  });
});
