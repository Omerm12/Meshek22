/**
 * Header names used to pass verified-request state from Middleware
 * (src/lib/supabase/middleware.ts) to the downstream Server Component/Action
 * execution for the SAME request.
 *
 * No Node-specific imports here — this file is imported from Middleware,
 * which runs in the Edge runtime.
 *
 * Security note: Middleware strips any incoming value of both headers on
 * EVERY request (admin or not), and the user-id header additionally carries an
 * HMAC signature (see signVerifiedUserToken below), so even if the strip were
 * ever bypassed a forged value would fail verification and the caller would
 * fall back to a full supabase.auth.getUser() check.
 */

/**
 * Set to a signed token containing the verified user's id, but ONLY after Middleware's own
 * `supabase.auth.getUser()` call has cryptographically validated the session
 * against the Auth server. getAdminUser() (src/lib/admin/auth.ts) trusts this
 * to skip a second, redundant getUser() network round trip for the same
 * token — it never skips the separate profiles/role lookup.
 */
export const ADMIN_VERIFIED_USER_ID_HEADER = "x-admin-verified-user-id";

/**
 * A correlation id minted once per request by Middleware, purely for log
 * correlation — safe to fall back to a freshly generated one if absent (e.g.
 * a request that didn't pass through Middleware), since it carries no
 * authorization meaning.
 */
export const ADMIN_REQUEST_ID_HEADER = "x-admin-request-id";

// ─── Signed identity token ───────────────────────────────────────────────────
//
// A bare user id in a header is only as trustworthy as the guarantee that
// Middleware stripped every client-supplied copy on EVERY code path. That is a
// fragile invariant (early returns, a new route group, a matcher change would
// each silently break it), so the header carries an HMAC-SHA256-signed,
// short-lived token instead. Only code holding the server secret can mint one;
// a client-supplied or tampered value fails verification and the caller falls
// back to a full supabase.auth.getUser() check. WebCrypto only — usable from
// Middleware and the Node runtime alike.

/** A token older than this is rejected (Middleware→render happens in ms). */
export const VERIFIED_USER_TOKEN_TTL_MS = 60_000;

/**
 * Prefers a dedicated ADMIN_TOKEN_SIGNING_SECRET (>= 32 chars) so the token
 * does not depend on the Supabase service-role key; falls back to that key
 * (domain-separated in hmacHex) when it is not configured. Tokens live 60s, so
 * adding or rotating the secret needs no migration: in-flight tokens simply
 * fail verification and the caller does its own getUser().
 */
function serverSecret(): string | null {
  const dedicated = process.env.ADMIN_TOKEN_SIGNING_SECRET;
  if (dedicated && dedicated.length >= 32) return dedicated;
  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return fallback && fallback.length >= 16 ? fallback : null;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`admin-verified-user:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Returns `<userId>.<issuedAtMs>.<signature>`, or null if no secret is configured. */
export async function signVerifiedUserToken(
  userId: string,
  now: number = Date.now(),
  secret: string | null = serverSecret()
): Promise<string | null> {
  if (!secret) return null;
  const payload = `${userId}.${now}`;
  return `${payload}.${await hmacHex(secret, payload)}`;
}

/** Returns the user id if the token is authentic and fresh, otherwise null. */
export async function verifyVerifiedUserToken(
  token: string | null | undefined,
  now: number = Date.now(),
  secret: string | null = serverSecret()
): Promise<string | null> {
  if (!token || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, issuedAtRaw, signature] = parts;
  const issuedAt = Number(issuedAtRaw);
  if (!userId || !Number.isFinite(issuedAt)) return null;
  const age = now - issuedAt;
  if (age < -5_000 || age > VERIFIED_USER_TOKEN_TTL_MS) return null;
  const expected = await hmacHex(secret, `${userId}.${issuedAtRaw}`);
  return constantTimeEqual(expected, signature) ? userId : null;
}
