import { describe, expect, it } from "vitest";
import { formatDeliveryDays } from "@/lib/delivery";

/**
 * Delivery-days formatting, wired into the checkout address summary. The zone
 * data itself (delivery_zones.delivery_days) is a plain text[] of Hebrew
 * weekday names or "YYYY-MM-DD" dates — see 001_initial_schema.sql and
 * src/lib/validations/admin-delivery-zone.ts, the admin form that writes it.
 */
describe("formatDeliveryDays", () => {
  it("returns null for no configured days, so the caller can show a fallback", () => {
    expect(formatDeliveryDays(null)).toBeNull();
    expect(formatDeliveryDays(undefined)).toBeNull();
    expect(formatDeliveryDays([])).toBeNull();
  });

  it("sorts days into natural Hebrew week order regardless of storage order", () => {
    expect(formatDeliveryDays(["חמישי", "ראשון", "שלישי"])).toBe("ראשון, שלישי וחמישי");
  });

  it("uses 'ו' before the final day, and no separator for a single day", () => {
    expect(formatDeliveryDays(["ראשון"])).toBe("ראשון");
    expect(formatDeliveryDays(["ראשון", "שלישי"])).toBe("ראשון ושלישי");
    expect(formatDeliveryDays(["ראשון", "שלישי", "חמישי"])).toBe("ראשון, שלישי וחמישי");
  });

  it("covers every weekday in the correct Sunday-to-Saturday order", () => {
    const all = ["שבת", "שישי", "רביעי", "שני", "ראשון", "חמישי", "שלישי"];
    expect(formatDeliveryDays(all)).toBe("ראשון, שני, שלישי, רביעי, חמישי, שישי ושבת");
  });

  it("formats a specific 'YYYY-MM-DD' date in Israeli DD/MM/YYYY order", () => {
    expect(formatDeliveryDays(["2026-09-10"])).toBe("10/09/2026");
  });

  it("keeps recurring weekdays before one-off dates", () => {
    expect(formatDeliveryDays(["2026-09-10", "ראשון"])).toBe("ראשון ו10/09/2026");
  });
});
