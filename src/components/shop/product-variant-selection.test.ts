import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Structural checks for rule 4 of the kilogram-first initial-selection fix:
 * once a customer manually picks a different variant, nothing may switch
 * them back. There is no jsdom/testing-library in this project (see
 * vitest.config.ts), so — consistent with the rest of the suite — this
 * asserts on the component source: `selectedVariant` must be seeded via
 * `useState(...)` exactly once from the initial variant, and no effect may
 * re-run `setSelectedVariant` whenever `product` (and therefore the
 * kilogram-first default) changes. `toMockProduct()`'s own selection logic is
 * covered separately in storefront.test.ts and variant-selection.test.ts.
 */
const components = [
  ["ProductCard", "src/components/shop/ProductCard.tsx"],
  ["ProductShell", "src/components/shop/ProductShell.tsx"],
  ["SearchProductCard", "src/components/layout/SearchProductCard.tsx"],
] as const;

describe.each(components)("%s: manual variant selection is never reverted", (_name, path) => {
  const source = readFileSync(path, "utf8");

  it("seeds selectedVariant from useState (computed once at mount)", () => {
    expect(source).toMatch(/useState[<\w\s|]*>?\(defaultVariant\)/);
  });

  it("never re-runs setSelectedVariant from an effect keyed on the product prop", () => {
    // These components don't (and must not) import useEffect at all — the
    // moment one does, it becomes possible to reset the customer's manual
    // choice back to the kilogram default whenever `product` re-renders.
    expect(source).not.toMatch(/\buseEffect\b/);
    expect(source).not.toMatch(/setSelectedVariant\([^)]*defaultVariant/);
  });
});
