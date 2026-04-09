/**
 * Static settlement name list — used only as a fallback reference.
 *
 * IMPORTANT: Zone assignment (delivery_zone_id) is now stored exclusively in
 * the database (settlements table). Do NOT add a `zone` field here — that was
 * the source of a slug-mismatch bug where hardcoded slugs diverged from the DB.
 *
 * In the checkout flow, settlements are fetched from the DB at page load and
 * passed as props. This file is kept only for cases where the DB list is
 * unavailable (e.g. unit tests, future static fallback).
 */

export interface Settlement {
  name: string;
}

/**
 * Search settlements by name prefix/substring.
 * Normalises both sides: lowercase + collapsed whitespace.
 * Returns up to `limit` matches (default 20).
 */
export function searchSettlements(query: string, limit = 20): Settlement[] {
  const q = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!q) return [];
  return SETTLEMENTS.filter((s) =>
    s.name.toLowerCase().replace(/\s+/g, " ").includes(q)
  ).slice(0, limit);
}

export const SETTLEMENTS: Settlement[] = [
  // גוש דן מרכזי
  { name: "תל אביב-יפו" },
  { name: "רמת גן" },
  { name: "גבעתיים" },
  { name: "בני ברק" },
  { name: "אור יהודה" },
  { name: "גבעת שמואל" },
  { name: "קריית אונו" },
  { name: "אזור" },
  { name: "יהוד-מונוסון" },
  // גוש דן רחב
  { name: "פתח תקווה" },
  { name: "חולון" },
  { name: "בת ים" },
  { name: "ראשון לציון" },
  { name: "רחובות" },
  { name: "לוד" },
  { name: "רמלה" },
  { name: "נס ציונה" },
  { name: "אשדוד" },
  { name: "גדרה" },
  { name: "יבנה" },
  { name: "מזכרת בתיה" },
  { name: "רמת השרון" },
  { name: "הרצליה" },
  { name: "רעננה" },
  { name: "כפר סבא" },
  { name: "הוד השרון" },
  { name: "אלעד" },
  { name: "ראש העין" },
  { name: "מודיעין עילית" },
  // מרכז הארץ
  { name: "נתניה" },
  { name: "חדרה" },
  { name: "זכרון יעקב" },
  { name: "מודיעין-מכבים-רעות" },
  { name: "בית שמש" },
  { name: "קרית מלאכי" },
  { name: "אשקלון" },
  { name: "רישון לציון (מזרח)" },
  { name: "טירת כרמל" },
  { name: "פרדס חנה-כרכור" },
  { name: "עמנואל" },
  { name: "ארד" },
  { name: "קלנסווה" },
  { name: "טייבה" },
  { name: "טול כרם" },
  // ירושלים והסביבה
  { name: "ירושלים" },
  { name: "מעלה אדומים" },
  { name: "בית אל" },
  { name: "גבעת זאב" },
  { name: "ביתר עילית" },
  { name: "אפרת" },
  { name: "אבו גוש" },
  { name: "קרית ארבע" },
  { name: "בית לחם הגלילית" },
  // צפון
  { name: "חיפה" },
  { name: "קריות (קרית ביאליק)" },
  { name: "קרית ים" },
  { name: "קרית מוצקין" },
  { name: "קרית אתא" },
  { name: "עכו" },
  { name: "נהריה" },
  { name: "נצרת" },
  { name: "נצרת עילית (נוף הגליל)" },
  { name: "עפולה" },
  { name: "כרמיאל" },
  { name: "טבריה" },
  { name: "צפת" },
  { name: "כפר כנא" },
  { name: "מגדל העמק" },
  { name: "בית שאן" },
  { name: "שפרעם" },
  // דרום
  { name: "באר שבע" },
  { name: "אילת" },
  { name: "דימונה" },
  { name: "נתיבות" },
  { name: "שדרות" },
  { name: "אופקים" },
  { name: "ירוחם" },
  { name: "מצפה רמון" },
  { name: "רהט" },
];
