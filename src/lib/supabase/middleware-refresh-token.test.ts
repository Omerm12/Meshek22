import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * updateSession() is the earliest admin-route chokepoint (runs before
 * requireAdmin() on every /meshek22-control/* request), so it is the right
 * place to notice a refresh token Supabase has already rejected
 * ("Invalid Refresh Token: Refresh Token Not Found", code
 * refresh_token_not_found) and clean up rather than let it fail the same
 * way on every subsequent request. Structural, consistent with the rest of
 * this admin test suite — mocking @supabase/ssr's createServerClient plus
 * NextRequest/NextResponse cookie plumbing for a real integration test would
 * add a lot of brittle mock surface for a middleware function whose control
 * flow is otherwise this small and this critical to get exactly right by
 * inspection.
 */
const source = readFileSync("src/lib/supabase/middleware.ts", "utf8");

describe("updateSession(): stale refresh token handling", () => {
  it("checks specifically for the refresh_token_not_found error code — not every auth error", () => {
    expect(source).toContain('error?.code === "refresh_token_not_found"');
  });

  it("signs out (clearing only the Supabase auth cookies this client manages) rather than touching cookies manually", () => {
    const idx = source.indexOf('error?.code === "refresh_token_not_found"');
    const block = source.slice(idx, idx + 800);
    expect(block).toContain("supabase.auth.signOut()");
    // Never reads/logs the token itself.
    expect(block).not.toMatch(/refresh_token\s*[:=]/);
  });

  it("redirects to login with a distinguishing, non-looping reason — never back to an admin page", () => {
    const idx = source.indexOf('error?.code === "refresh_token_not_found"');
    const block = source.slice(idx, idx + 800);
    expect(block).toContain("ADMIN_ROUTES.login");
    expect(block).toContain('"reason"');
    expect(block).toContain("session_expired");
  });

  it("carries the cleared cookies onto the redirect response, so the browser doesn't keep resending the stale one", () => {
    const idx = source.indexOf('error?.code === "refresh_token_not_found"');
    const block = source.slice(idx, idx + 800);
    expect(block).toMatch(/supabaseResponse\.cookies\.getAll\(\)/);
    expect(block).toMatch(/redirectResponse\.cookies\.set/);
  });

  it("never retries the getUser()/refresh call — one attempt, then a clean redirect", () => {
    const matches = source.match(/supabase\.auth\.getUser\(\)/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it("the login page stays reachable without a session (no redirect loop)", () => {
    expect(source).toContain("pathname === ADMIN_ROUTES.login");
  });

  it("still falls back to the existing generic redirect for any other auth failure", () => {
    expect(source).toContain("if (!user) {");
  });
});
