import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MissingRateLimitSaltError, isAdminLoginRateLimited } from "@/lib/admin/rate-limit";

/**
 * The rate limiter hashes identities so the table never holds a raw IP or
 * username. Without a salt those digests are plain SHA-256 of a short, highly
 * predictable value — reversible with a trivial rainbow table — so a missing
 * salt must stop sign-in rather than quietly run unprotected.
 */
const ORIGINAL_SALT = process.env.ADMIN_RATE_LIMIT_SALT;

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  if (ORIGINAL_SALT === undefined) delete process.env.ADMIN_RATE_LIMIT_SALT;
  else process.env.ADMIN_RATE_LIMIT_SALT = ORIGINAL_SALT;
  vi.restoreAllMocks();
});

describe("ADMIN_RATE_LIMIT_SALT", () => {
  const identities = [
    { kind: "ip" as const, value: "203.0.113.7" },
    { kind: "username" as const, value: "admin" },
  ];

  it("fails closed when the salt is missing", async () => {
    delete process.env.ADMIN_RATE_LIMIT_SALT;
    await expect(isAdminLoginRateLimited(identities)).rejects.toBeInstanceOf(
      MissingRateLimitSaltError
    );
  });

  it("fails closed when the salt is blank", async () => {
    process.env.ADMIN_RATE_LIMIT_SALT = "   ";
    await expect(isAdminLoginRateLimited(identities)).rejects.toBeInstanceOf(
      MissingRateLimitSaltError
    );
  });

  it("does not let the fail-open database handler swallow the missing salt", async () => {
    // The salt is checked before the try/catch that deliberately fails open on a
    // logging outage. If it were inside, a missing salt would silently disable
    // rate limiting entirely — the worst possible outcome.
    delete process.env.ADMIN_RATE_LIMIT_SALT;
    await expect(isAdminLoginRateLimited(identities)).rejects.toThrow(
      /ADMIN_RATE_LIMIT_SALT/
    );
  });
});

describe("admin login action", () => {
  it("refuses to sign in and reports a configuration error", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("src/app/meshek22-control/login/actions.ts", "utf8");

    expect(source).toContain("MissingRateLimitSaltError");
    expect(source).toContain("CONFIG_ERROR");
    // The real cause is logged server-side, never shown to the browser.
    expect(source).toContain("ADMIN_RATE_LIMIT_SALT is not configured");
    expect(source).toContain("תצורת השרת אינה מלאה");
  });
});

describe(".env.example", () => {
  it("documents every required variable with placeholders only", async () => {
    const { readFileSync } = await import("node:fs");
    const env = readFileSync(".env.example", "utf8");

    for (const key of [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "NEXT_PUBLIC_SITE_URL",
      "CARDCOM_TERMINAL_NUMBER",
      "CARDCOM_API_NAME",
      "RESEND_API_KEY",
      "EMAIL_FROM_ADDRESS",
      "EMAIL_ADMIN_ADDRESS",
      "ADMIN_LOGIN_USERNAME",
      "ADMIN_AUTH_EMAIL",
      "ADMIN_RATE_LIMIT_SALT",
    ]) {
      expect(env, `${key} should be documented`).toContain(key);
    }
  });

  it("carries no real credentials", async () => {
    const { readFileSync } = await import("node:fs");
    const env = readFileSync(".env.example", "utf8");

    // A real Supabase key is a JWT; a real OpenAI key is a long sk-proj- string.
    expect(env).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
    expect(env).not.toMatch(/sk-proj-[A-Za-z0-9_-]{20,}/);
    expect(env).not.toMatch(/re_[A-Za-z0-9]{20,}/);
  });

  it("no longer advertises the removed PayPlus/PAYMENT_* settings", async () => {
    const { readFileSync } = await import("node:fs");
    const env = readFileSync(".env.example", "utf8");

    expect(env).not.toMatch(/PAYPLUS/i);
    expect(env).not.toContain("PAYMENT_TERMINAL_NAME");
    expect(env).not.toContain("PAYMENT_PASSWORD");
  });
});
