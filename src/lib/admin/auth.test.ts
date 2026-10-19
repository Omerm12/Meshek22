import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * getAdminUser()'s header-trust fast path: Middleware (src/lib/supabase/
 * middleware.ts) already calls supabase.auth.getUser() once per request and
 * forwards the verified user id via ADMIN_VERIFIED_USER_ID_HEADER. This is
 * the other half of that fix — when the header is present, getAdminUser()
 * must skip its OWN getUser() call (a second, redundant network round trip
 * for the identical token) and go straight to the profiles/role lookup,
 * which is NEVER skipped either way.
 */

const { getUserMock, profilesSingleMock, headersGetMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  profilesSingleMock: vi.fn(),
  headersGetMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: headersGetMock })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: profilesSingleMock,
        })),
      })),
    })),
  })),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

import { getAdminUser } from "@/lib/admin/auth";

const ADMIN_PROFILE = { id: "user-123", email: "a@b.com", full_name: "Admin", role: "admin" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  headersGetMock.mockReturnValue(null);
  getUserMock.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });
  profilesSingleMock.mockResolvedValue({ data: ADMIN_PROFILE, error: null });
});

describe("getAdminUser(): header-trust fast path", () => {
  it("skips getUser() entirely when Middleware's verified-user header is present", async () => {
    headersGetMock.mockReturnValue("user-123"); // ADMIN_VERIFIED_USER_ID_HEADER

    const admin = await getAdminUser();

    expect(getUserMock).not.toHaveBeenCalled();
    expect(admin).toEqual(ADMIN_PROFILE);
  });

  it("still runs the profiles/role lookup even when the header is trusted — identity != authorization", async () => {
    headersGetMock.mockReturnValue("user-123");
    profilesSingleMock.mockResolvedValue({ data: { ...ADMIN_PROFILE, role: "customer" }, error: null });

    const admin = await getAdminUser();

    expect(profilesSingleMock).toHaveBeenCalled();
    expect(admin).toBeNull();
  });

  it("looks up the profile using the header's user id, not a hardcoded or stale value", async () => {
    headersGetMock.mockReturnValue("some-other-user-id");
    profilesSingleMock.mockResolvedValue({
      data: { id: "some-other-user-id", email: null, full_name: null, role: "admin" },
      error: null,
    });

    const admin = await getAdminUser();

    expect(admin?.id).toBe("some-other-user-id");
  });

  it("falls back to the full getUser() check when the header is absent (e.g. a request that bypassed Middleware)", async () => {
    headersGetMock.mockReturnValue(null);

    const admin = await getAdminUser();

    expect(getUserMock).toHaveBeenCalledTimes(1);
    expect(admin).toEqual(ADMIN_PROFILE);
  });

  it("the fallback path still returns null on a genuine getUser() failure", async () => {
    headersGetMock.mockReturnValue(null);
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "invalid token" } });

    const admin = await getAdminUser();

    expect(admin).toBeNull();
    expect(profilesSingleMock).not.toHaveBeenCalled();
  });
});
