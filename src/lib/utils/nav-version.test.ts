import { describe, expect, it } from "vitest";
import { computeNavbarVersion } from "@/lib/utils/nav-version";
import type { NavCategoryNode } from "@/lib/data/storefront";

/**
 * computeNavbarVersion is the fingerprint Header.tsx compares against
 * /api/nav/version to decide whether an already-open tab's navbar (fetched
 * once, potentially minutes ago via the client-side Router Cache on a static
 * route like the homepage — see next.config.ts's default staleTimes) is
 * still current. It must change whenever the rendered navbar would change,
 * and only then.
 */

function node(overrides: Partial<NavCategoryNode> = {}): NavCategoryNode {
  return {
    id: "veg",
    name: "ירקות",
    slug: "vegetables",
    href: "/vegetables",
    icon: "carrot",
    children: [],
    ...overrides,
  };
}

describe("computeNavbarVersion", () => {
  it("is identical for the identical tree (same objects, different array instances)", () => {
    const tree: NavCategoryNode[] = [node(), node({ id: "fru", name: "פירות", slug: "fruits" })];
    expect(computeNavbarVersion([...tree])).toBe(computeNavbarVersion([...tree]));
  });

  it("changes when top-level order changes, even with the exact same nodes", () => {
    const a = node({ id: "veg", name: "ירקות" });
    const b = node({ id: "mushrooms", name: "פטריות ומיוחדים", slug: "mushrooms" });
    expect(computeNavbarVersion([a, b])).not.toBe(computeNavbarVersion([b, a]));
  });

  it("changes when a node is renamed (e.g. an admin edits a category name)", () => {
    const tree = [node()];
    const renamed = [node({ name: "ירקות טריים" })];
    expect(computeNavbarVersion(tree)).not.toBe(computeNavbarVersion(renamed));
  });

  it("changes when a node is hidden (removed from the built tree by buildNavbarTree)", () => {
    const withMushrooms = [node(), node({ id: "mushrooms", name: "פטריות", slug: "mushrooms" })];
    const withoutMushrooms = [node()];
    expect(computeNavbarVersion(withMushrooms)).not.toBe(computeNavbarVersion(withoutMushrooms));
  });

  it("changes when a child's order changes within its parent's submenu", () => {
    const a = node({
      children: [
        { id: "c1", name: "אחד", slug: "one", href: "/vegetables?sub=one" },
        { id: "c2", name: "שתיים", slug: "two", href: "/vegetables?sub=two" },
      ],
    });
    const b = node({
      children: [
        { id: "c2", name: "שתיים", slug: "two", href: "/vegetables?sub=two" },
        { id: "c1", name: "אחד", slug: "one", href: "/vegetables?sub=one" },
      ],
    });
    expect(computeNavbarVersion([a])).not.toBe(computeNavbarVersion([b]));
  });

  it("is stable for an empty tree and never throws", () => {
    expect(computeNavbarVersion([])).toBe("");
  });
});
