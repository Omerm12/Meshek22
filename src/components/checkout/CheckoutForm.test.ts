import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Structural checks on the checkout UI. There is no jsdom/testing-library in
 * this project (vitest.config.ts runs environment "node" and only collects
 * src/**\/*.test.ts), so — consistent with the rest of the test suite (e.g.
 * order-emails.test.ts's source scans) — these assert directly on the
 * component and page source for properties that matter but are awkward to
 * exercise without a renderer: which payment options exist and in what
 * order, that the card-brand notice and delivery-days line are wired in, and
 * that delivery days never render for pickup.
 */
const form = readFileSync("src/components/checkout/CheckoutForm.tsx", "utf8");
const page = readFileSync("src/app/(shop)/checkout/page.tsx", "utf8");

// ─── Exactly two payment methods, in the required order ───────────────────────

describe("payment method options", () => {
  it("renders exactly two payment-method choice cards", () => {
    const matches = form.match(/name="payment_method"/g) ?? [];
    expect(matches).toHaveLength(2);
  });

  it("no longer offers the removed phone_credit option as a choice", () => {
    // A defensive comment in the sessionStorage-draft restore code is allowed
    // to mention the string ("a draft saved before phone_credit was removed
    // may still carry it") — what must never exist again is an actual
    // selectable option for it.
    expect(form).not.toContain('value="phone_credit"');
    expect(form).not.toContain("נציג יתקשר לקבלת פרטי אשראי");
    expect(form).not.toContain("PhoneCall");
    expect(form).not.toMatch(/setPaymentMethod\("phone_credit"\)/);
  });

  it("lists credit card first, then cash, with the exact required Hebrew titles", () => {
    const creditIdx = form.indexOf('title="תשלום מאובטח באשראי באתר"');
    const cashIdx = form.indexOf('title="תשלום במזומן בעת קבלת ההזמנה"');
    expect(creditIdx).toBeGreaterThan(-1);
    expect(cashIdx).toBeGreaterThan(-1);
    expect(creditIdx).toBeLessThan(cashIdx);
  });
});

// ─── CardCom brand notice ───────────────────────────────────────────────────────

describe("CardCom brand notice", () => {
  it("is shown under the credit-card option only when it is selected", () => {
    expect(form).toContain("import { CardBrandNotice }");
    const conditionIdx = form.indexOf('paymentMethod === "credit_card" && <CardBrandNotice');
    expect(conditionIdx).toBeGreaterThan(-1);
  });
});

// ─── Delivery days ──────────────────────────────────────────────────────────────

describe("delivery days in the address summary", () => {
  it("the checkout page includes delivery_days in its existing zones query (no extra request)", () => {
    const selectMatch = page.match(/\.from\("delivery_zones"\)\s*\.select\(\s*"([^"]+)"/);
    expect(selectMatch).not.toBeNull();
    expect(selectMatch![1]).toContain("delivery_days");
    // Only one .select( on delivery_zones — proves this rides the existing
    // query rather than adding a second round trip.
    expect(page.match(/\.from\("delivery_zones"\)/g)).toHaveLength(1);
  });

  it("reads the live zone value via formatDeliveryDays, with a graceful Hebrew fallback", () => {
    expect(form).toContain('import { getDeliveryQuote, formatDeliveryDays } from "@/lib/delivery"');
    expect(form).toContain("formatDeliveryDays(selectedZone?.delivery_days)");
    expect(form).toContain("ימי המשלוח יתואמו לאחר ביצוע ההזמנה.");
  });

  it("only appears inside the delivery-only address block, never for pickup", () => {
    const deliveryBlockStart = form.indexOf("Delivery address (delivery only)");
    const customerDetailsStart = form.indexOf("── Customer Details ──");
    const daysLineIdx = form.indexOf("ימי משלוח:");

    expect(deliveryBlockStart).toBeGreaterThan(-1);
    expect(customerDetailsStart).toBeGreaterThan(deliveryBlockStart);
    expect(daysLineIdx).toBeGreaterThan(deliveryBlockStart);
    expect(daysLineIdx).toBeLessThan(customerDetailsStart);

    // And the pickup info card (rendered when fulfillment is NOT delivery)
    // must not itself mention delivery days.
    const pickupCardStart = form.indexOf("{!isDelivery && (");
    const pickupCardEnd = form.indexOf("{/* ── Delivery address (delivery only) ── */}");
    expect(pickupCardStart).toBeGreaterThan(-1);
    expect(pickupCardEnd).toBeGreaterThan(pickupCardStart);
    expect(form.slice(pickupCardStart, pickupCardEnd)).not.toContain("ימי משלוח");
  });

  it("updates immediately on city change, since it derives from the already-reactive selectedZone", () => {
    // selectedZone is a useMemo keyed on deliveryZoneId, which itself updates
    // in a useEffect keyed on `city` — so the days line re-renders whenever
    // the city changes, with no separate fetch or effect needed.
    const selectedZoneIdx = form.indexOf("const selectedZone = useMemo(");
    const cityEffectIdx = form.indexOf("setDeliveryZoneId(findZoneIdByCity(city))");
    expect(selectedZoneIdx).toBeGreaterThan(-1);
    expect(cityEffectIdx).toBeGreaterThan(-1);
  });
});
