import { existsSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The three legacy routes that used to be (or lead to) the combined
 * גלידות ופיצוחים page, all of which now redirect into עוד מהמשק
 * (more-from-the-farm) — either its "הכל" view or a specific child tab.
 *
 * next/navigation is stubbed because permanentRedirect() only works inside a
 * request. The real implementation throws a control-flow signal that Next
 * catches and turns into a 308 response, so the stub throws too — that way a
 * page which failed to stop after redirecting would fail this test.
 */
const { permanentRedirect } = vi.hoisted(() => ({
  permanentRedirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("next/navigation", () => ({ permanentRedirect }));

import LegacyIceCreamsPage from "@/app/(shop)/ice-creams/page";
import LegacyNutsPage from "@/app/(shop)/nuts/page";
import LegacyIceCreamsAndNutsPage from "@/app/(shop)/ice-creams-and-nuts/page";
import { getCategoryHero } from "@/lib/config/category-heroes";
import {
  MERGED_CATEGORY_REDIRECTS,
  MORE_FROM_THE_FARM_HREF,
  MORE_FROM_THE_FARM_SLUG,
} from "@/lib/config/nav-categories";

beforeEach(() => {
  permanentRedirect.mockClear();
});

describe("retired category routes", () => {
  it("/ice-creams-and-nuts permanently redirects to the עוד מהמשק page", () => {
    expect(() => LegacyIceCreamsAndNutsPage()).toThrow(/NEXT_REDIRECT/);
    expect(permanentRedirect).toHaveBeenCalledTimes(1);
    expect(permanentRedirect).toHaveBeenCalledWith(MORE_FROM_THE_FARM_HREF);
  });

  it("/ice-creams permanently redirects straight to the גלידות child tab", () => {
    expect(() => LegacyIceCreamsPage()).toThrow(/NEXT_REDIRECT/);
    expect(permanentRedirect).toHaveBeenCalledTimes(1);
    expect(permanentRedirect).toHaveBeenCalledWith(`${MORE_FROM_THE_FARM_HREF}?sub=ice-creams`);
  });

  it("/nuts permanently redirects straight to the פיצוחים child tab", () => {
    expect(() => LegacyNutsPage()).toThrow(/NEXT_REDIRECT/);
    expect(permanentRedirect).toHaveBeenCalledTimes(1);
    expect(permanentRedirect).toHaveBeenCalledWith(`${MORE_FROM_THE_FARM_HREF}?sub=nuts`);
  });

  it("uses permanentRedirect (308), not a temporary redirect (307)", () => {
    // permanentRedirect is Next's 308 API; redirect() would emit 307 and let
    // search engines keep the old URL indexed.
    expect(() => LegacyIceCreamsAndNutsPage()).toThrow();
    expect(() => LegacyIceCreamsPage()).toThrow();
    expect(() => LegacyNutsPage()).toThrow();
    expect(permanentRedirect).toHaveBeenCalledTimes(3);
  });

  it("matches the redirect map exactly, with no redirect loop", () => {
    for (const [from, to] of Object.entries(MERGED_CATEGORY_REDIRECTS)) {
      expect(to).not.toBe(from);
      expect(to.startsWith(MORE_FROM_THE_FARM_HREF)).toBe(true);
    }
  });
});

describe("עוד מהמשק hero (used by the new parent page)", () => {
  it("resolves a hero with the required title and supporting text", () => {
    const hero = getCategoryHero(MORE_FROM_THE_FARM_SLUG);

    expect(hero.title).toBe("עוד מהמשק");
    expect(hero.subtitle.length).toBeGreaterThan(0);
  });

  it("points the hero at an image that actually exists in /public", () => {
    const hero = getCategoryHero(MORE_FROM_THE_FARM_SLUG);

    // Reused temporarily from the combined category it replaces.
    expect(hero.imageSrc).toBe(
      "/images/heroes/8e8052e1-1d80-4837-bd6d-ac93c4394d8a.png"
    );
    // Guards against the hero silently 404-ing if the asset is ever moved.
    expect(existsSync(join(process.cwd(), "public", hero.imageSrc))).toBe(true);
    expect(hero.imageAlt).toBeTruthy();
  });

  it("covers the banner from its centre so the text area stays in frame", () => {
    const hero = getCategoryHero(MORE_FROM_THE_FARM_SLUG);

    expect(hero.imageObjectFit).toBe("cover");
    expect(hero.imageObjectPosition).toBe("center");
  });

  it("scrims the text area so white text stays legible over the photo", () => {
    const hero = getCategoryHero(MORE_FROM_THE_FARM_SLUG);

    expect(hero.decorativeGradient).toContain("radial-gradient");
    expect(hero.overlayColor).toBeTruthy();
    expect(hero.decorativeGradient).toContain("%");
  });

  it("keeps a solid fallback paint in case the photo fails to load", () => {
    const hero = getCategoryHero(MORE_FROM_THE_FARM_SLUG);

    expect(hero.containerBg).toMatch(/^#[0-9a-f]{6}$/i);
    expect(hero.backgroundGradient).toContain("linear-gradient");
  });

  it("falls back to a usable hero for an unknown slug", () => {
    const hero = getCategoryHero("does-not-exist");
    expect(hero.imageSrc).toBe("");
    expect(hero.headingColor).toBeTruthy();
  });
});
