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

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(async () => ({ auth: { getUser: getUserMock } })),
}));

vi.mock("@/lib/supabase/server", () => ({
  // Cookie-session client: ONLY used for the getUser() fallback, never for the
  // role lookup (see getAdminUser).
  createClient: createClientMock,
  // Service-role client: used for the profiles/role lookup.
  createAdminClient: vi.fn(() => ({
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
import { signVerifiedUserToken } from "@/lib/admin/request-headers";

const SECRET = "test-service-role-secret-0123456789";


const ADMIN_PROFILE = { id: "user-123", email: "a@b.com", full_name: "Admin", role: "admin" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", SECRET);
  vi.spyOn(console, "log").mockImplementation(() => {});
  headersGetMock.mockReturnValue(null);
  getUserMock.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });
  profilesSingleMock.mockResolvedValue({ data: ADMIN_PROFILE, error: null });
});

describe("getAdminUser(): header-trust fast path", () => {
  it("skips getUser() entirely when Middleware's verified-user header is present", async () => {
    headersGetMock.mockReturnValue(await signVerifiedUserToken("user-123"));

    const admin = await getAdminUser();

    expect(getUserMock).not.toHaveBeenCalled();
    expect(admin).toEqual(ADMIN_PROFILE);
  });

  it("still runs the profiles/role lookup even when the header is trusted — identity != authorization", async () => {
    headersGetMock.mockReturnValue(await signVerifiedUserToken("user-123"));
    profilesSingleMock.mockResolvedValue({ data: { ...ADMIN_PROFILE, role: "customer" }, error: null });

    const admin = await getAdminUser();

    expect(profilesSingleMock).toHaveBeenCalled();
    expect(admin).toBeNull();
  });

  it("looks up the profile using the header's user id, not a hardcoded or stale value", async () => {
    headersGetMock.mockReturnValue(await signVerifiedUserToken("some-other-user-id"));
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

describe("getAdminUser(): a client-supplied header can never grant access", () => {
  it.each([
    ["a bare user id", async () => "user-123"],
    ["a token signed with the wrong secret", async () => signVerifiedUserToken("user-123", Date.now(), "attacker-secret-0123456789")],
    ["a token for a different user with the original signature", async () => {
      const t = (await signVerifiedUserToken("user-123"))!.split(".");
      return `other-user.${t[1]}.${t[2]}`;
    }],
    ["an expired token", async () => signVerifiedUserToken("user-123", Date.now() - 120_000)],
    ["garbage", async () => "a.b.c"],
  ])("%s is ignored and the full getUser() check still runs", async (_label, makeHeader) => {
    headersGetMock.mockReturnValue(await makeHeader());
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "no session" } });

    const admin = await getAdminUser();

    expect(getUserMock).toHaveBeenCalledTimes(1);
    expect(admin).toBeNull();
    expect(profilesSingleMock).not.toHaveBeenCalled();
  });

  it("with no server secret configured nothing is trusted", async () => {
    const token = await signVerifiedUserToken("user-123");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    headersGetMock.mockReturnValue(token);
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "x" } });

    expect(await getAdminUser()).toBeNull();
    expect(getUserMock).toHaveBeenCalledTimes(1);
  });
});

describe("signing secret selection", () => {
  it("a token signed with the dedicated secret verifies, and one signed with the fallback key then does not", async () => {
    vi.stubEnv("ADMIN_TOKEN_SIGNING_SECRET", "dedicated-secret-0123456789-0123456789");
    const t = await signVerifiedUserToken("user-123");
    headersGetMock.mockReturnValue(t);
    expect(await getAdminUser()).toEqual(ADMIN_PROFILE);
    expect(getUserMock).not.toHaveBeenCalled();

    vi.unstubAllEnvs();
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", SECRET);
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "x" } });
    expect(await getAdminUser()).toBeNull();
    expect(getUserMock).toHaveBeenCalledTimes(1);
  });
});

describe("getAdminUser(): the role lookup never goes through the cookie-session client", () => {
  it("with a valid Middleware token no session client is created at all, so an expired cookie token can never trigger a refresh stall", async () => {
    headersGetMock.mockReturnValue(await signVerifiedUserToken("user-123"));
    const admin = await getAdminUser();
    expect(admin).toEqual(ADMIN_PROFILE);
    expect(createClientMock).not.toHaveBeenCalled();
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it("on the fallback path the session client is used only for getUser()", async () => {
    headersGetMock.mockReturnValue(null);
    await getAdminUser();
    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(getUserMock).toHaveBeenCalledTimes(1);
  });

  it("still denies a verified id whose profile is not an admin", async () => {
    headersGetMock.mockReturnValue(await signVerifiedUserToken("user-123"));
    profilesSingleMock.mockResolvedValue({ data: { ...ADMIN_PROFILE, role: "customer" }, error: null });
    expect(await getAdminUser()).toBeNull();
  });

  it("denies when the profile read fails or finds no row (fail closed)", async () => {
    headersGetMock.mockReturnValue(await signVerifiedUserToken("user-123"));
    profilesSingleMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await getAdminUser()).toBeNull();
  });
});
