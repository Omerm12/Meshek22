import { describe, expect, it } from "vitest";
import { CARDCOM_TERMINAL_NUMBER, CONFIRMED_CARD_BRANDS, GENERIC_CARD_NOTICE } from "@/lib/payment/cardcom-brands";

/**
 * The single configuration source for confirmed CardCom card brands (issue 3
 * in the checkout fix set). Nothing about accepted brands can be conclusively
 * verified for the production terminal from this codebase, so
 * CONFIRMED_CARD_BRANDS must stay empty and the checkout must show the exact
 * generic Hebrew notice until the business owner confirms with CardCom.
 */
describe("CardCom card-brand configuration", () => {
  it("points at the real production terminal", () => {
    expect(CARDCOM_TERMINAL_NUMBER).toBe("189307");
  });

  it("has no conclusively verified brands yet", () => {
    // Must not be guessed from a card-number prefix, general CardCom
    // capability, or 3D Secure being enabled — only from a confirmed
    // terminal configuration. Until then: empty.
    expect(CONFIRMED_CARD_BRANDS).toEqual([]);
  });

  it("carries the exact required Hebrew fallback notice, unmodified", () => {
    expect(GENERIC_CARD_NOTICE).toBe(
      "ניתן לשלם בכרטיסי האשראי הנתמכים במסוף העסק. אם הכרטיס אינו מתקבל בדף הסליקה, יש לנסות כרטיס אחר."
    );
  });
});
