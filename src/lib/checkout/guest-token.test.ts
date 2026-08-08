import { describe, expect, it } from "vitest";
import {
  createGuestAccessToken,
  guestTokenHashMatches,
  hashGuestAccessToken,
  isPlausibleGuestToken,
} from "@/lib/checkout/guest-token";

describe("guest order access token", () => {
  it("mints a URL-safe token of the expected length", () => {
    const token = createGuestAccessToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(isPlausibleGuestToken(token)).toBe(true);
  });

  it("never repeats a token", () => {
    const tokens = new Set(Array.from({ length: 500 }, () => createGuestAccessToken()));
    expect(tokens.size).toBe(500);
  });

  it("stores only a hash — the token cannot be read back out of it", () => {
    const token = createGuestAccessToken();
    const hash = hashGuestAccessToken(token);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(hash).not.toBe(token);
  });

  it("hashes deterministically so a lookup by hash works", () => {
    const token = createGuestAccessToken();
    expect(hashGuestAccessToken(token)).toBe(hashGuestAccessToken(token));
  });

  it("produces a different hash for a different token", () => {
    expect(hashGuestAccessToken(createGuestAccessToken())).not.toBe(
      hashGuestAccessToken(createGuestAccessToken())
    );
  });

  it("matches only the correct token's hash", () => {
    const token = createGuestAccessToken();
    const other = createGuestAccessToken();
    const stored = hashGuestAccessToken(token);

    expect(guestTokenHashMatches(stored, hashGuestAccessToken(token))).toBe(true);
    expect(guestTokenHashMatches(stored, hashGuestAccessToken(other))).toBe(false);
  });

  it("never matches when either side is missing", () => {
    const hash = hashGuestAccessToken(createGuestAccessToken());
    expect(guestTokenHashMatches(null, hash)).toBe(false);
    expect(guestTokenHashMatches(hash, null)).toBe(false);
    expect(guestTokenHashMatches(null, null)).toBe(false);
    // A legacy order with no token stored can never be opened by guessing.
    expect(guestTokenHashMatches(null, hash)).toBe(false);
  });

  it("rejects tokens that could not have come from createGuestAccessToken", () => {
    // An order number alone must never look like a valid token — this is what
    // stops a guest from opening another customer's order by guessing M22-000123.
    expect(isPlausibleGuestToken("M22-000123")).toBe(false);
    expect(isPlausibleGuestToken("")).toBe(false);
    expect(isPlausibleGuestToken("short")).toBe(false);
    expect(isPlausibleGuestToken(undefined)).toBe(false);
    expect(isPlausibleGuestToken(null)).toBe(false);
    expect(isPlausibleGuestToken(12345)).toBe(false);
    // Right length, but characters outside the base64url alphabet.
    expect(isPlausibleGuestToken("!".repeat(43))).toBe(false);
  });
});
