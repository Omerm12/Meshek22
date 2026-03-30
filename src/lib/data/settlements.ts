/**
 * Static Israeli settlement → delivery zone mapping.
 * Zone slugs correspond to delivery_zones.slug in the DB.
 */

export interface Settlement {
  name: string;
  zone: string; // delivery_zones.slug
}

// zone-center   → גוש דן מרכזי
// zone-gush-dan → גוש דן רחב
// zone-central  → מרכז הארץ
// zone-jerusalem → ירושלים והסביבה
// zone-north    → צפון
// zone-south    → דרום

export const SETTLEMENTS: Settlement[] = [
  // ── גוש דן מרכזי ──────────────────────────────────────
  { name: "תל אביב-יפו", zone: "zone-center" },
  { name: "רמת גן", zone: "zone-center" },
  { name: "גבעתיים", zone: "zone-center" },
  { name: "בני ברק", zone: "zone-center" },
  { name: "אור יהודה", zone: "zone-center" },
  { name: "גבעת שמואל", zone: "zone-center" },
  { name: "קריית אונו", zone: "zone-center" },
  { name: "אזור", zone: "zone-center" },
  { name: "יהוד-מונוסון", zone: "zone-center" },

  // ── גוש דן רחב ───────────────────────────────────────
  { name: "פתח תקווה", zone: "zone-gush-dan" },
  { name: "חולון", zone: "zone-gush-dan" },
  { name: "בת ים", zone: "zone-gush-dan" },
  { name: "ראשון לציון", zone: "zone-gush-dan" },
  { name: "רחובות", zone: "zone-gush-dan" },
  { name: "לוד", zone: "zone-gush-dan" },
  { name: "רמלה", zone: "zone-gush-dan" },
  { name: "נס ציונה", zone: "zone-gush-dan" },
  { name: "אשדוד", zone: "zone-gush-dan" },
  { name: "גדרה", zone: "zone-gush-dan" },
  { name: "יבנה", zone: "zone-gush-dan" },
  { name: "מזכרת בתיה", zone: "zone-gush-dan" },
  { name: "רמת השרון", zone: "zone-gush-dan" },
  { name: "הרצליה", zone: "zone-gush-dan" },
  { name: "רעננה", zone: "zone-gush-dan" },
  { name: "כפר סבא", zone: "zone-gush-dan" },
  { name: "הוד השרון", zone: "zone-gush-dan" },
  { name: "אלעד", zone: "zone-gush-dan" },
  { name: "ראש העין", zone: "zone-gush-dan" },
  { name: "מודיעין עילית", zone: "zone-gush-dan" },

  // ── מרכז הארץ ────────────────────────────────────────
  { name: "נתניה", zone: "zone-central" },
  { name: "חדרה", zone: "zone-central" },
  { name: "זכרון יעקב", zone: "zone-central" },
  { name: "מודיעין-מכבים-רעות", zone: "zone-central" },
  { name: "בית שמש", zone: "zone-central" },
  { name: "קרית מלאכי", zone: "zone-central" },
  { name: "אשקלון", zone: "zone-central" },
  { name: "רישון לציון (מזרח)", zone: "zone-central" },
  { name: "טירת כרמל", zone: "zone-central" },
  { name: "פרדס חנה-כרכור", zone: "zone-central" },
  { name: "עמנואל", zone: "zone-central" },
  { name: "ארד", zone: "zone-central" },
  { name: "קלנסווה", zone: "zone-central" },
  { name: "טייבה", zone: "zone-central" },
  { name: "טול כרם", zone: "zone-central" },

  // ── ירושלים והסביבה ──────────────────────────────────
  { name: "ירושלים", zone: "zone-jerusalem" },
  { name: "מעלה אדומים", zone: "zone-jerusalem" },
  { name: "בית אל", zone: "zone-jerusalem" },
  { name: "גבעת זאב", zone: "zone-jerusalem" },
  { name: "ביתר עילית", zone: "zone-jerusalem" },
  { name: "אפרת", zone: "zone-jerusalem" },
  { name: "אבו גוש", zone: "zone-jerusalem" },
  { name: "קרית ארבע", zone: "zone-jerusalem" },
  { name: "בית לחם הגלילית", zone: "zone-jerusalem" },

  // ── צפון ─────────────────────────────────────────────
  { name: "חיפה", zone: "zone-north" },
  { name: "קריות (קרית ביאליק)", zone: "zone-north" },
  { name: "קרית ים", zone: "zone-north" },
  { name: "קרית מוצקין", zone: "zone-north" },
  { name: "קרית אתא", zone: "zone-north" },
  { name: "עכו", zone: "zone-north" },
  { name: "נהריה", zone: "zone-north" },
  { name: "נצרת", zone: "zone-north" },
  { name: "נצרת עילית (נוף הגליל)", zone: "zone-north" },
  { name: "עפולה", zone: "zone-north" },
  { name: "כרמיאל", zone: "zone-north" },
  { name: "טבריה", zone: "zone-north" },
  { name: "צפת", zone: "zone-north" },
  { name: "כפר כנא", zone: "zone-north" },
  { name: "מגדל העמק", zone: "zone-north" },
  { name: "בית שאן", zone: "zone-north" },
  { name: "שפרעם", zone: "zone-north" },

  // ── דרום ─────────────────────────────────────────────
  { name: "באר שבע", zone: "zone-south" },
  { name: "אילת", zone: "zone-south" },
  { name: "דימונה", zone: "zone-south" },
  { name: "נתיבות", zone: "zone-south" },
  { name: "שדרות", zone: "zone-south" },
  { name: "אופקים", zone: "zone-south" },
  { name: "ירוחם", zone: "zone-south" },
  { name: "מצפה רמון", zone: "zone-south" },
  { name: "רהט", zone: "zone-south" },
];

/**
 * Search settlements by partial name (case-insensitive, Hebrew-aware).
 */
export function searchSettlements(query: string): Settlement[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return SETTLEMENTS.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 8);
}

/**
 * Find a settlement by exact name.
 */
export function findSettlement(name: string): Settlement | undefined {
  return SETTLEMENTS.find((s) => s.name === name);
}
