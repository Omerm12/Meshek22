import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Structural checks on the homepage "מועדי משלוח" delivery-timing callout.
 * No jsdom/testing-library in this project (vitest.config.ts, environment
 * "node"), so — consistent with the rest of the suite — these assert
 * directly on the component source.
 */
const source = readFileSync("src/components/home/HowItWorks.tsx", "utf8");

const CLARIFICATION =
  "ימי המשלוח משתנים בהתאם לאזור החלוקה. לאחר בחירת יישוב בעמוד התשלום יוצגו ימי המשלוח ודמי המשלוח הרלוונטיים. מועד האספקה הסופי כפוף לאישור ההזמנה ולזמינות המלאי.";

describe("homepage delivery schedule clarification", () => {
  it("adds the exact required Hebrew clarification line", () => {
    expect(source).toContain(CLARIFICATION);
  });

  it("places it directly under the existing 'after 12:00' rule", () => {
    const afterRuleIdx = source.indexOf("הזמנות שהתקבלו לאחר השעה 12:00 — יסופקו ביום העסקים הבא");
    const beforeRuleIdx = source.indexOf("הזמנות שהתקבלו לפני השעה 12:00 — יסופקו באותו יום עסקים");
    const clarificationIdx = source.indexOf(CLARIFICATION);

    expect(afterRuleIdx).toBeGreaterThan(-1);
    expect(beforeRuleIdx).toBeGreaterThan(-1);
    expect(clarificationIdx).toBeGreaterThan(-1);
    expect(beforeRuleIdx).toBeLessThan(afterRuleIdx);
    expect(afterRuleIdx).toBeLessThan(clarificationIdx);
  });

  it("stays inside the same delivery-timing callout box, not a separate section", () => {
    const calloutStart = source.indexOf("{/* Delivery timing callout */}");
    const calloutEnd = source.indexOf("</Reveal>", calloutStart);
    expect(calloutStart).toBeGreaterThan(-1);
    expect(calloutEnd).toBeGreaterThan(calloutStart);
    const clarificationIdx = source.indexOf(CLARIFICATION);
    expect(clarificationIdx).toBeGreaterThan(calloutStart);
    expect(clarificationIdx).toBeLessThan(calloutEnd);
  });

  it("is styled smaller/lighter than the two main rules, and stays responsive", () => {
    const clarificationLineStart = source.lastIndexOf("<p", source.indexOf(CLARIFICATION));
    const clarificationTag = source.slice(clarificationLineStart, source.indexOf(">", clarificationLineStart));
    // Smaller and lighter than the main rules' "text-lg lg:text-xl font-semibold".
    expect(clarificationTag).toMatch(/text-sm/);
    expect(clarificationTag).not.toContain("font-semibold");
    // Still wraps responsively / RTL is inherited from the page (no dir override needed).
    expect(clarificationTag).toContain("leading-relaxed");
    expect(source).not.toContain('dir="ltr"');
  });

  it("does not touch the two existing delivery-timing rules", () => {
    expect(source).toContain("הזמנות שהתקבלו לפני השעה 12:00 — יסופקו באותו יום עסקים");
    expect(source).toContain("הזמנות שהתקבלו לאחר השעה 12:00 — יסופקו ביום העסקים הבא");
  });
});
