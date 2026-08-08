import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Guest order access tokens.
 *
 * A guest order has no user account behind it, so the order number alone must
 * never be enough to read it — order numbers are short and sequential-looking,
 * and could be guessed. Instead, order creation mints a 256-bit random token:
 *
 *   • the customer receives the plaintext token in their success URL,
 *   • the database stores only its SHA-256 digest.
 *
 * Every guest-facing lookup (success page, payment polling, payment retry)
 * requires the token. A database leak therefore does not expose working access
 * links, and there is nothing reversible to steal.
 *
 * Server-only: node:crypto is unavailable in the browser, and the token must
 * never be derived on the client.
 */

/** Mint a fresh access token. URL-safe, 43 characters. */
export function createGuestAccessToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 (hex) of a token — the only form ever written to the database. */
export function hashGuestAccessToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Constant-time comparison of two token hashes.
 *
 * Both values are fixed-length hex digests, so a length mismatch means the input
 * was malformed rather than merely wrong.
 */
export function guestTokenHashMatches(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Cheap shape check before a token is used in a query. */
export function isPlausibleGuestToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{40,50}$/.test(token);
}
