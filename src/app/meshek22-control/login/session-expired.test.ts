import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/app/meshek22-control/login/page.tsx", "utf8");

describe("admin login page: session-expired banner", () => {
  it("reads the reason search param set by the middleware's refresh-token cleanup", () => {
    expect(source).toContain("searchParams: Promise<{ reason?: string }>");
    expect(source).toContain('reason === "session_expired"');
  });

  it("shows the required Hebrew message", () => {
    expect(source).toContain("פג תוקף החיבור. יש להתחבר מחדש.");
  });

  it("renders the banner separately from AdminLoginForm's own login-attempt error slot", () => {
    const bannerIdx = source.indexOf("sessionExpired &&");
    const formIdx = source.indexOf("<AdminLoginForm");
    expect(bannerIdx).toBeGreaterThan(-1);
    expect(bannerIdx).toBeLessThan(formIdx);
  });

  it("is announced to assistive tech", () => {
    const idx = source.indexOf("sessionExpired &&");
    const block = source.slice(idx, idx + 300);
    expect(block).toContain('role="alert"');
    expect(block).toContain('aria-live="assertive"');
  });
});
