import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Structural coverage for the admin performance fix: Middleware's
 * supabase.auth.getUser() call was observed in production spiking to 6+
 * seconds (see the investigation notes on AUTH_CHECK_TIMEOUT_MS in
 * src/lib/supabase/middleware.ts), traced to @supabase/auth-js's internal
 * refresh-with-exponential-backoff retrying for up to 30s on a transient
 * network failure. No jsdom/testing-library in this repo (see
 * Header.test.ts) and mocking @supabase/ssr's createServerClient plus
 * NextRequest/NextResponse cookie plumbing for a real integration test would
 * add a lot of brittle mock surface for a function this small and this
 * critical to get exactly right — consistent with
 * middleware-refresh-token.test.ts, this is pinned by source inspection.
 */
const source = readFileSync("src/lib/supabase/middleware.ts", "utf8");

describe("Middleware auth check is bounded, never hangs indefinitely", () => {
  it("wraps the getUser() call in a timeout, not an unbounded await", () => {
    expect(source).toContain("withTimeout(supabase.auth.getUser(), AUTH_CHECK_TIMEOUT_MS)");
  });

  it("AUTH_CHECK_TIMEOUT_MS is a real, finite bound — not Infinity or disabled", () => {
    const match = source.match(/const AUTH_CHECK_TIMEOUT_MS = (\d+);/);
    expect(match).not.toBeNull();
    const ms = Number(match?.[1]);
    expect(ms).toBeGreaterThan(0);
    // Below the ~30s worst case auth-js's own retry loop could reach —
    // otherwise this bound doesn't actually improve the worst case.
    expect(ms).toBeLessThan(30_000);
  });

  it("a timed-out auth check is treated as 'no user', not silently allowed through", () => {
    // The catch block must NOT set `user` — it only sets `timedOut`/`error`,
    // leaving `user` at its initial `null`, so the existing `if (!user)`
    // redirect-to-login below still fires. This is the "fail closed" check:
    // there is no code path where a timeout results in `user` being set.
    const catchIdx = source.indexOf("} catch (thrown) {");
    const catchBlockEnd = source.indexOf("const authMs = Date.now()", catchIdx);
    expect(catchIdx).toBeGreaterThan(-1);
    expect(catchBlockEnd).toBeGreaterThan(catchIdx);
    const catchBlock = source.slice(catchIdx, catchBlockEnd);
    expect(catchBlock).not.toMatch(/\buser\s*=/);
  });

  it("still redirects to login when there is no verified user, timeout or not", () => {
    expect(source).toContain("if (!user) {");
    const idx = source.indexOf("if (!user) {");
    expect(source.slice(idx, idx + 200)).toContain("NextResponse.redirect");
  });

  it("logs Middleware auth timing with a correlation id and outcome, safe/sanitized fields only", () => {
    const idx = source.indexOf('scope: "middleware-auth"', source.indexOf("console.log"));
    expect(idx).toBeGreaterThan(-1);
    const block = source.slice(idx, idx + 300);
    expect(block).toContain("reqId");
    expect(block).toContain("authMs");
    expect(block).toContain("outcome");
    // Never logs the token/cookie/user email.
    expect(block).not.toMatch(/access_token|refresh_token|email/i);
  });
});

describe("Middleware forwards verified-request state to the downstream render", () => {
  it("strips any incoming value before setting the verified-user header — a client can never inject it", () => {
    const setIdx = source.indexOf("request.headers.set(ADMIN_VERIFIED_USER_ID_HEADER");
    const deleteIdx = source.indexOf("request.headers.delete(ADMIN_VERIFIED_USER_ID_HEADER)");
    expect(deleteIdx).toBeGreaterThan(-1);
    expect(setIdx).toBeGreaterThan(deleteIdx);
  });

  it("only sets the verified-user header after confirming a user exists (past the `if (!user)` guard)", () => {
    const guardIdx = source.indexOf("if (!user) {");
    const setIdx = source.indexOf("request.headers.set(ADMIN_VERIFIED_USER_ID_HEADER");
    expect(setIdx).toBeGreaterThan(guardIdx);
  });

  it("sets the verified-user header to the actual verified user's id, not a static/guessable value", () => {
    expect(source).toContain("request.headers.set(ADMIN_VERIFIED_USER_ID_HEADER, user.id)");
  });

  it("also forwards a per-request correlation id, stripped and re-set the same way", () => {
    expect(source).toContain("request.headers.delete(ADMIN_REQUEST_ID_HEADER)");
    expect(source).toContain("request.headers.set(ADMIN_REQUEST_ID_HEADER, reqId)");
  });

  it("still carries over any refreshed-session cookies onto the final response", () => {
    const finalIdx = source.indexOf("const finalResponse = NextResponse.next({ request });");
    expect(finalIdx).toBeGreaterThan(-1);
    const tail = source.slice(finalIdx, finalIdx + 400);
    expect(tail).toContain("supabaseResponse.cookies.getAll()");
    expect(tail).toContain("finalResponse.cookies.set(cookie)");
    expect(tail).toContain("return finalResponse;");
  });
});
