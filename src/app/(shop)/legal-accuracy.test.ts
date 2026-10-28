import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
const privacy = read("src/app/(shop)/privacy/page.tsx");
const terms = read("src/app/(shop)/terms/page.tsx");
const checkout = read("src/components/checkout/CheckoutForm.tsx");

/**
 * The legal pages must describe what the site actually does. These guard the
 * specific contradictions found in the October 2026 audit. They do not make
 * any statement about legal compliance.
 */
describe("privacy policy matches the real system", () => {
  it("does not describe OTP/account login, which no longer exists", () => {
    expect(privacy).not.toMatch(/OTP/);
    expect(privacy).not.toContain("נתוני התחברות");
  });
  it("states Supabase is outside Israel (Singapore), not Europe", () => {
    expect(privacy).not.toContain("באירופה");
    expect(privacy).toContain("בסינגפור");
  });
  it("discloses every processor that receives customer data", () => {
    for (const name of ["Supabase", "Vercel", "Resend", "Cardcom"]) expect(privacy).toContain(name);
  });
});

describe("terms match the real checkout", () => {
  it("does not require creating an account (guest checkout)", () => {
    expect(terms).not.toContain("לאחר יצירת חשבון משתמש");
  });
  it("states the legal entity name and company number from the single business-identity source", () => {
    expect(terms).toContain("BUSINESS_IDENTITY.name");
    expect(terms).toContain("BUSINESS_IDENTITY.taxId");
  });
  it("does not say online payments are unavailable", () => {
    expect(terms).not.toMatch(/אין (אפשרות|תשלום) (לשלם )?(מקוון|אונליין)/);
    expect(terms).toContain("Cardcom");
  });
});

describe("checkout links to the legal pages", () => {
  it("shows links to the Terms and the Privacy Policy next to the order button", () => {
    expect(checkout).toContain('href="/terms"');
    expect(checkout).toContain('href="/privacy"');
  });
});
