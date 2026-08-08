import { existsSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The combined גלידות ופיצוחים page, and the two routes it replaced.
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
import { metadata as combinedMetadata } from "@/app/(shop)/ice-creams-and-nuts/page";
import CombinedPage from "@/app/(shop)/ice-creams-and-nuts/page";
import { getCategoryHero } from "@/lib/config/category-heroes";
import {
  ICE_CREAMS_AND_NUTS_HREF,
  ICE_CREAMS_AND_NUTS_SLUG,
} from "@/lib/config/nav-categories";

beforeEach(() => {
  permanentRedirect.mockClear();
});

describe("retired category routes", () => {
  it("/ice-creams permanently redirects to the combined page", () => {
    expect(() => LegacyIceCreamsPage()).toThrow(/NEXT_REDIRECT/);
    expect(permanentRedirect).toHaveBeenCalledTimes(1);
    expect(permanentRedirect).toHaveBeenCalledWith(ICE_CREAMS_AND_NUTS_HREF);
  });

  it("/nuts permanently redirects to the combined page", () => {
    expect(() => LegacyNutsPage()).toThrow(/NEXT_REDIRECT/);
    expect(permanentRedirect).toHaveBeenCalledTimes(1);
    expect(permanentRedirect).toHaveBeenCalledWith(ICE_CREAMS_AND_NUTS_HREF);
  });

  it("uses permanentRedirect (308), not a temporary redirect (307)", () => {
    // permanentRedirect is Next's 308 API; redirect() would emit 307 and let
    // search engines keep the old URL indexed.
    expect(() => LegacyIceCreamsPage()).toThrow();
    expect(() => LegacyNutsPage()).toThrow();
    expect(permanentRedirect).toHaveBeenCalledTimes(2);
  });
});

describe("combined category page", () => {
  it("is a real page module", () => {
    expect(typeof CombinedPage).toBe("function");
  });

  it("carries Hebrew metadata naming the combined category", () => {
    expect(combinedMetadata.title).toBe("גלידות ופיצוחים – משק 22");
    expect(String(combinedMetadata.description)).toContain("משהו מתוק");
  });

  it("resolves a hero with the required title and supporting text", () => {
    const hero = getCategoryHero(ICE_CREAMS_AND_NUTS_SLUG);

    expect(hero.title).toBe("גלידות ופיצוחים");
    expect(hero.subtitle).toBe("משהו מתוק, משהו מלוח — כל הפינוקים במקום אחד.");
  });

  it("points the hero at an image that actually exists in /public", () => {
    const hero = getCategoryHero(ICE_CREAMS_AND_NUTS_SLUG);

    expect(hero.imageSrc).toBe(
      "/images/heroes/8e8052e1-1d80-4837-bd6d-ac93c4394d8a.png"
    );
    // Guards against the hero silently 404-ing if the asset is ever moved.
    expect(existsSync(join(process.cwd(), "public", hero.imageSrc))).toBe(true);
    expect(hero.imageAlt).toBeTruthy();
  });

  it("covers the banner from its centre so the text area stays in frame", () => {
    const hero = getCategoryHero(ICE_CREAMS_AND_NUTS_SLUG);

    // The photo's empty middle band is where the heading sits; cropping from
    // the centre keeps it on screen from 375px up to desktop.
    expect(hero.imageObjectFit).toBe("cover");
    expect(hero.imageObjectPosition).toBe("center");
  });

  it("scrims the text area so white text stays legible over the photo", () => {
    const hero = getCategoryHero(ICE_CREAMS_AND_NUTS_SLUG);

    // The centre of the photograph is light cream; without this the heading
    // would sit at roughly 1.5:1 contrast.
    expect(hero.decorativeGradient).toContain("radial-gradient");
    expect(hero.decorativeGradient).toContain("50% 46%");
    expect(hero.overlayColor).toBeTruthy();
    // Percentage-based, so the scrim tracks the banner at every breakpoint
    // rather than being pinned to one size.
    expect(hero.decorativeGradient).toContain("%");
  });

  it("keeps a solid fallback paint in case the photo fails to load", () => {
    const hero = getCategoryHero(ICE_CREAMS_AND_NUTS_SLUG);

    expect(hero.containerBg).toMatch(/^#[0-9a-f]{6}$/i);
    expect(hero.backgroundGradient).toContain("linear-gradient");
  });

  it("falls back to a usable hero for an unknown slug", () => {
    const hero = getCategoryHero("does-not-exist");
    expect(hero.imageSrc).toBe("");
    expect(hero.headingColor).toBeTruthy();
  });
});
