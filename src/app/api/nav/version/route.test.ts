import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * fetchNavbarVersion() itself (the shared-cache behaviour) is exercised via
 * computeNavbarVersion in nav-version.test.ts and via buildNavbarTree's own
 * suite in storefront.test.ts. This file only checks the route handler's
 * contract: it calls fetchNavbarVersion() and returns its result as JSON,
 * which is all Header.tsx's polling fetch("/api/nav/version") relies on.
 */

const { fetchNavbarVersion } = vi.hoisted(() => ({
  fetchNavbarVersion: vi.fn(),
}));

vi.mock("@/lib/data/storefront", () => ({ fetchNavbarVersion }));

import { GET } from "@/app/api/nav/version/route";

describe("GET /api/nav/version", () => {
  beforeEach(() => {
    fetchNavbarVersion.mockReset();
  });

  it("returns the current navbar version as JSON", async () => {
    fetchNavbarVersion.mockResolvedValue("veg:ירקות:|fru:פירות:");

    const res = await GET();
    const body = await res.json();

    expect(body).toEqual({ version: "veg:ירקות:|fru:פירות:" });
  });

  it("calls fetchNavbarVersion() rather than issuing its own Supabase query", async () => {
    fetchNavbarVersion.mockResolvedValue("v1");
    await GET();
    expect(fetchNavbarVersion).toHaveBeenCalledTimes(1);
    expect(fetchNavbarVersion).toHaveBeenCalledWith();
  });
});
