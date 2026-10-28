import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import TermsPage from "./page";

describe("terms page — VAT policy", () => {
  const html = renderToStaticMarkup(TermsPage());

  it("has a VAT section with the VAT-inclusive, delivery and final-amount principles", () => {
    expect(html).toContain("מחירים ומע״מ");
    expect(html).toContain("וכוללים מע״מ כחוק, ככל שהוא חל על המוצר");
    expect(html).toContain("ואינו מתווסף אליו בעת התשלום");
    expect(html).toContain("דמי המשלוח מוצגים בנפרד");
    expect(html).toContain("הסכום הסופי לחיוב יוצג ללקוח לפני אישור התשלום");
  });

  it("does not claim every fruit and vegetable is zero-rated", () => {
    expect(html).toContain("שהדין מחיל עליהם מע״מ בשיעור אפס");
    expect(html).toContain("אינו חל באופן אוטומטי על כל פרי או ירק");
  });

  it("describes online credit-card payment accurately and no longer says online payment is unavailable", () => {
    expect(html).not.toContain("אינו מאפשר תשלום מקוון");
    expect(html).toContain("ניתן לשלם באתר בכרטיס אשראי");
    expect(html).toContain("Cardcom");
    expect(html).toContain("ההזמנה תיחשב כשולמה רק לאחר שחברת הסליקה אישרה את התשלום");
    expect(html).toContain("ניתן לבחור גם לשלם במזומן בעת קבלת ההזמנה");
  });

  it("keeps the existing sections, now numbered 1–9 in order", () => {
    const titles = [...html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map((m) => m[1]);
    expect(titles.map((t) => t.split(".")[0])).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
    expect(titles).toContain("4. תשלום");
    expect(titles).toContain("6. משלוחים");
    expect(titles).toContain("7. ביטולים והחזרות");
    expect(titles).toContain("9. יצירת קשר");
  });
});
