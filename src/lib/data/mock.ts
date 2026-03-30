// ─── Mock data for homepage (replace with Supabase queries in production) ─────

export interface MockCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;       // emoji
  color: string;      // tailwind bg class
  textColor: string;
  count: number;
}

export interface MockVariant {
  id: string;
  label: string;
  unit: string;
  priceAgorot: number;
  comparePriceAgorot: number | null;
  isDefault: boolean;
}

export interface MockProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  longDescription?: string;
  categorySlug: string;
  categoryName: string;
  isFeatured: boolean;
  variants: MockVariant[];
  imageColor: string;  // css color for gradient background
  icon: string;        // emoji
}

// ─── Categories ───────────────────────────────────────────────────────────────

export const MOCK_CATEGORIES: MockCategory[] = [
  {
    id: "cat-1",
    name: "ירקות",
    slug: "yerakot",
    description: "ירקות טריים מהשדה",
    icon: "🥬",
    color: "bg-green-50",
    textColor: "text-green-700",
    count: 12,
  },
  {
    id: "cat-2",
    name: "פירות",
    slug: "perot",
    description: "פירות עונתיים טריים",
    icon: "🍎",
    color: "bg-red-50",
    textColor: "text-red-700",
    count: 8,
  },
  {
    id: "cat-3",
    name: "עשבי תיבול",
    slug: "isvey-tivul",
    description: "עשבי תיבול טריים",
    icon: "🌿",
    color: "bg-emerald-50",
    textColor: "text-emerald-700",
    count: 6,
  },
  {
    id: "cat-4",
    name: "ירקות שורש",
    slug: "shoresh",
    description: "גזר, סלק, לפת ועוד",
    icon: "🥕",
    color: "bg-orange-50",
    textColor: "text-orange-700",
    count: 6,
  },
  {
    id: "cat-5",
    name: "ביצים ומוצרי חלב",
    slug: "beitsim",
    description: "ביצי חופש וגבינות",
    icon: "🥚",
    color: "bg-yellow-50",
    textColor: "text-yellow-700",
    count: 4,
  },
  {
    id: "cat-6",
    name: "סלטים מוכנים",
    slug: "salatim",
    description: "סלטים טריים מהמשק",
    icon: "🥗",
    color: "bg-lime-50",
    textColor: "text-lime-700",
    count: 5,
  },
  {
    id: "cat-7",
    name: "קטניות",
    slug: "ktniyot",
    description: "אפונה, שעועית ותירס",
    icon: "🫛",
    color: "bg-teal-50",
    textColor: "text-teal-700",
    count: 5,
  },
  {
    id: "cat-8",
    name: "מיצים טבעיים",
    slug: "mitsim",
    description: "מיצים סחוטים טריים",
    icon: "🍋",
    color: "bg-amber-50",
    textColor: "text-amber-700",
    count: 4,
  },
];

// ─── Products ─────────────────────────────────────────────────────────────────

export const MOCK_PRODUCTS: MockProduct[] = [
  // ── ירקות ────────────────────────────────────────────────────────────────
  {
    id: "p-001",
    name: "עגבנייה טרייה",
    slug: "agvaniya",
    description: "עגבניות בשלות ועסיסיות",
    longDescription:
      "עגבניות שלנו נקטפות בשיא הבשלות ישירות מהשדה, ומגיעות אליכם כשהן עדיין חמות מהשמש. עשירות בטעם מרוכז ועסיסי, ללא הנבטה מאולצת. מתאימות לסלט ישראלי, ממרח, רוטב פסטה וכמעט לכל מנה.",
    categorySlug: "yerakot",
    categoryName: "ירקות",
    isFeatured: true,
    icon: "🍅",
    imageColor: "#ffedd5",
    variants: [
      { id: "v-001a", label: "500 גרם", unit: "500g", priceAgorot: 490, comparePriceAgorot: null, isDefault: false },
      { id: "v-001b", label: '1 ק"ג', unit: "1kg", priceAgorot: 890, comparePriceAgorot: null, isDefault: true },
      { id: "v-001c", label: '2 ק"ג', unit: "2kg", priceAgorot: 1590, comparePriceAgorot: 1780, isDefault: false },
    ],
  },
  {
    id: "p-002",
    name: "מלפפון",
    slug: "melafelon",
    description: "מלפפונים פריכים וטריים",
    longDescription:
      "מלפפונים בסגנון המשק הישן – פריכים, ניחוחיים ומרעננים. נקטפים כשהם קטנים ועדיין רכים, ומגיעים אליכם ביממה אחת מהשדה. מצוינים לסלט, לכבישה מהירה ולאכילה ישירות.",
    categorySlug: "yerakot",
    categoryName: "ירקות",
    isFeatured: true,
    icon: "🥒",
    imageColor: "#dcfce7",
    variants: [
      { id: "v-002a", label: "500 גרם", unit: "500g", priceAgorot: 390, comparePriceAgorot: null, isDefault: false },
      { id: "v-002b", label: '1 ק"ג', unit: "1kg", priceAgorot: 690, comparePriceAgorot: null, isDefault: true },
      { id: "v-002c", label: "מארז 5 יח׳", unit: "pack", priceAgorot: 990, comparePriceAgorot: 1200, isDefault: false },
    ],
  },
  {
    id: "p-003",
    name: "פלפל צבעוני",
    slug: "pilpel",
    description: "פלפלים מתוקים אדום, צהוב וירוק",
    longDescription:
      "תערובת פלפלים מתוקים בשלושה צבעים – אדום, צהוב וירוק. כל אחד עם טעם ייחודי: האדום מתקתק, הצהוב עדין, הירוק קצת מריר. מצוינים לצלייה, לסלט או לאכילה חיים.",
    categorySlug: "yerakot",
    categoryName: "ירקות",
    isFeatured: false,
    icon: "🫑",
    imageColor: "#fef9c3",
    variants: [
      { id: "v-003a", label: "יחידה", unit: "unit", priceAgorot: 290, comparePriceAgorot: null, isDefault: true },
      { id: "v-003b", label: "500 גרם", unit: "500g", priceAgorot: 590, comparePriceAgorot: null, isDefault: false },
    ],
  },
  {
    id: "p-009",
    name: "חסה ירוקה",
    slug: "chasa",
    description: "חסה טרייה ורעננה לסלט",
    longDescription:
      "חסה ירוקה גדולה ועסיסית, נקטפת בוקר בוקר ישירות מהשדה. עלים פריכים ורעננים, מתאימה לסלט ירוק, לסנדוויץ׳ ולכל מנה שדורשת ירוק טרי.",
    categorySlug: "yerakot",
    categoryName: "ירקות",
    isFeatured: false,
    icon: "🥬",
    imageColor: "#d1fae5",
    variants: [
      { id: "v-009a", label: "יחידה", unit: "unit", priceAgorot: 590, comparePriceAgorot: null, isDefault: true },
      { id: "v-009b", label: "2 יח׳", unit: "pack", priceAgorot: 1090, comparePriceAgorot: 1180, isDefault: false },
    ],
  },
  {
    id: "p-010",
    name: "קישוא",
    slug: "kishua",
    description: "קישואים ירוקים עדינים",
    longDescription:
      "קישואים צעירים ועדינים, מושלמים לטיגון, לצלייה או לאפייה. קוטרם הקטן מבטיח קליפה רכה וגרעינים מעטים. שלמים לפסטה, לרטטואי ולמנות ים תיכוניות.",
    categorySlug: "yerakot",
    categoryName: "ירקות",
    isFeatured: false,
    icon: "🥒",
    imageColor: "#ecfdf5",
    variants: [
      { id: "v-010a", label: '1 ק"ג', unit: "1kg", priceAgorot: 590, comparePriceAgorot: null, isDefault: true },
      { id: "v-010b", label: '2 ק"ג', unit: "2kg", priceAgorot: 1090, comparePriceAgorot: 1180, isDefault: false },
    ],
  },
  {
    id: "p-011",
    name: "חציל",
    slug: "chatsil",
    description: "חצילים טריים מהמשק",
    longDescription:
      "חצילים שחורים ומבריקים, נקטפים בבשלות מלאה. בשרם צפוף וטעמם עמוק. מצוינים לצלייה על הפחמים, לממרח חציל שרוף, למוסקה ולחביתה.",
    categorySlug: "yerakot",
    categoryName: "ירקות",
    isFeatured: false,
    icon: "🍆",
    imageColor: "#f3e8ff",
    variants: [
      { id: "v-011a", label: "יחידה", unit: "unit", priceAgorot: 490, comparePriceAgorot: null, isDefault: true },
      { id: "v-011b", label: '1 ק"ג', unit: "1kg", priceAgorot: 890, comparePriceAgorot: null, isDefault: false },
    ],
  },
  // ── פירות ────────────────────────────────────────────────────────────────
  {
    id: "p-004",
    name: "אבוקדו",
    slug: "avokado",
    description: "אבוקדו ישראלי בשל ואיכותי",
    longDescription:
      "אבוקדו ישראלי מגוון האס – בשרו קרמי, שמן וטעמו עשיר. נקטף בבשלות מלאה ומוכן לאכילה. מושלם לגוואקמולה, על טוסט ולסלטים.",
    categorySlug: "perot",
    categoryName: "פירות",
    isFeatured: true,
    icon: "🥑",
    imageColor: "#d1fae5",
    variants: [
      { id: "v-004a", label: "יחידה", unit: "unit", priceAgorot: 490, comparePriceAgorot: null, isDefault: true },
      { id: "v-004b", label: "3 יחידות", unit: "pack", priceAgorot: 1290, comparePriceAgorot: 1470, isDefault: false },
      { id: "v-004c", label: "5 יחידות", unit: "pack", priceAgorot: 1990, comparePriceAgorot: 2450, isDefault: false },
    ],
  },
  {
    id: "p-007",
    name: "תות שדה",
    slug: "tut-sade",
    description: "תותים אדומים מתוקים, עונתיים",
    longDescription:
      "תותי שדה ישראליים עונתיים, מגוון המתוק ביותר. נקטפים בבוקר ומגיעים אליכם ביום אחד. אדומים עד הפנים, עסיסיים ומבושמים. שלמים לאכילה טרייה, לקינוחים ולמשקאות.",
    categorySlug: "perot",
    categoryName: "פירות",
    isFeatured: true,
    icon: "🍓",
    imageColor: "#ffe4e6",
    variants: [
      { id: "v-007a", label: "250 גרם", unit: "250g", priceAgorot: 790, comparePriceAgorot: null, isDefault: true },
      { id: "v-007b", label: "500 גרם", unit: "500g", priceAgorot: 1390, comparePriceAgorot: 1580, isDefault: false },
    ],
  },
  {
    id: "p-013",
    name: "תפוח עץ",
    slug: "tapuach",
    description: "תפוחים ישראליים מתוקים",
    longDescription:
      "תפוחים ישראליים מגוון פינק ליידי, מתוקים עם חמיצות עדינה. עציצים ופריכים, עשירים בוויטמינים ובסיבים תזונתיים. מצוינים לאכילה, לאפייה וטחינה למיץ.",
    categorySlug: "perot",
    categoryName: "פירות",
    isFeatured: true,
    icon: "🍎",
    imageColor: "#fee2e2",
    variants: [
      { id: "v-013a", label: "500 גרם", unit: "500g", priceAgorot: 690, comparePriceAgorot: null, isDefault: false },
      { id: "v-013b", label: '1 ק"ג', unit: "1kg", priceAgorot: 1190, comparePriceAgorot: null, isDefault: true },
      { id: "v-013c", label: '2 ק"ג', unit: "2kg", priceAgorot: 2090, comparePriceAgorot: 2380, isDefault: false },
    ],
  },
  {
    id: "p-014",
    name: "לימון",
    slug: "limon",
    description: "לימונים צהובים עסיסיים",
    longDescription:
      "לימונים עסיסיים ומבושמים, עם קליפה דקה ומלאת שמן אתרי. כל לימון מכיל כמות גדולה של מיץ. מצוינים לסחיטה, לתיבול בשרים ולמאפים.",
    categorySlug: "perot",
    categoryName: "פירות",
    isFeatured: false,
    icon: "🍋",
    imageColor: "#fef9c3",
    variants: [
      { id: "v-014a", label: "יחידה", unit: "unit", priceAgorot: 190, comparePriceAgorot: null, isDefault: false },
      { id: "v-014b", label: "3 יח׳", unit: "pack", priceAgorot: 490, comparePriceAgorot: null, isDefault: true },
      { id: "v-014c", label: '1 ק"ג', unit: "1kg", priceAgorot: 890, comparePriceAgorot: null, isDefault: false },
    ],
  },
  // ── עשבי תיבול ───────────────────────────────────────────────────────────
  {
    id: "p-015",
    name: "פטרוזיליה",
    slug: "petrozilya",
    description: "פטרוזיליה טרייה ומבושמת",
    longDescription:
      "פטרוזיליה שטוחה טרייה, עלים ירוקים כהים ומבושמים. מרכיב בסיסי במטבח הישראלי – לסלט, לטחינה, לצ׳ופ ולכמעט כל מנה. נקטפת בבוקר ומגיעה לצרור.",
    categorySlug: "isvey-tivul",
    categoryName: "עשבי תיבול",
    isFeatured: false,
    icon: "🌿",
    imageColor: "#dcfce7",
    variants: [
      { id: "v-015a", label: "צרור", unit: "bunch", priceAgorot: 390, comparePriceAgorot: null, isDefault: true },
      { id: "v-015b", label: "2 צרורות", unit: "pack", priceAgorot: 690, comparePriceAgorot: 780, isDefault: false },
    ],
  },
  {
    id: "p-016",
    name: "כוסברה",
    slug: "kusbarah",
    description: "כוסברה טרייה לכל מנה",
    longDescription:
      "כוסברה ניחוחית וטרייה, ניחוחה האופייני מעשיר כל מנה. שלמה לסלסה, לקארי, לשאוורמה ולאוכל אסייתי. עלים עדינים ורכים, גבעולים טריים.",
    categorySlug: "isvey-tivul",
    categoryName: "עשבי תיבול",
    isFeatured: false,
    icon: "🌿",
    imageColor: "#d1fae5",
    variants: [
      { id: "v-016a", label: "צרור", unit: "bunch", priceAgorot: 390, comparePriceAgorot: null, isDefault: true },
      { id: "v-016b", label: "2 צרורות", unit: "pack", priceAgorot: 690, comparePriceAgorot: 780, isDefault: false },
    ],
  },
  {
    id: "p-017",
    name: "נענע טרייה",
    slug: "nana",
    description: "נענע מרעננת ומבושמת",
    longDescription:
      "נענע טרייה עם ניחוח חזק ורענן. עלים גדולים ומלאים, נקטפת בוקר בוקר. מצוינת לתה, לטבולה, לסלטים ולמשקאות קרים. ניחוחה ממלא את כל המטבח.",
    categorySlug: "isvey-tivul",
    categoryName: "עשבי תיבול",
    isFeatured: false,
    icon: "🌱",
    imageColor: "#ecfdf5",
    variants: [
      { id: "v-017a", label: "צרור", unit: "bunch", priceAgorot: 490, comparePriceAgorot: null, isDefault: true },
      { id: "v-017b", label: "2 צרורות", unit: "pack", priceAgorot: 850, comparePriceAgorot: 980, isDefault: false },
    ],
  },
  // ── ירקות שורש ───────────────────────────────────────────────────────────
  {
    id: "p-005",
    name: "גזר",
    slug: "gezer",
    description: "גזרים כתומים מתוקים ועסיסיים",
    longDescription:
      "גזרים ישראליים מתוקים וכתומים, מגידול חקלאי מקומי. עשירים בבטא קרוטן וויטמין A. מצוינים לאכילה חיה, לצלייה, למרקים ולמיצים.",
    categorySlug: "shoresh",
    categoryName: "ירקות שורש",
    isFeatured: true,
    icon: "🥕",
    imageColor: "#ffedd5",
    variants: [
      { id: "v-005a", label: "500 גרם", unit: "500g", priceAgorot: 390, comparePriceAgorot: null, isDefault: false },
      { id: "v-005b", label: '1 ק"ג', unit: "1kg", priceAgorot: 690, comparePriceAgorot: null, isDefault: true },
      { id: "v-005c", label: '2 ק"ג', unit: "2kg", priceAgorot: 1190, comparePriceAgorot: 1380, isDefault: false },
    ],
  },
  {
    id: "p-008",
    name: "בטטה",
    slug: "batata",
    description: "בטטות כתומות מתוקות לאפייה",
    longDescription:
      "בטטות ישראליות מגוון הכתום, מתוקות ועמוסות בבטא קרוטן. בשרן נהיה רך וקרמי בצלייה. מצוינות לאפייה, לפירה, למרקים ולפינגרס.",
    categorySlug: "shoresh",
    categoryName: "ירקות שורש",
    isFeatured: true,
    icon: "🍠",
    imageColor: "#fed7aa",
    variants: [
      { id: "v-008a", label: '1 ק"ג', unit: "1kg", priceAgorot: 890, comparePriceAgorot: null, isDefault: true },
      { id: "v-008b", label: '2 ק"ג', unit: "2kg", priceAgorot: 1590, comparePriceAgorot: 1780, isDefault: false },
    ],
  },
  {
    id: "p-012",
    name: "בצל סגול",
    slug: "batsal-sagol",
    description: "בצל סגול חריף ומתקתק",
    longDescription:
      "בצל סגול ישראלי, חריפותו מתונה יותר מהבצל הרגיל וניחוחו עדין. מצוין לסלטים חיים, לכבישה מהירה ולצלייה. נותן צבע יפה ורוד לכל מנה.",
    categorySlug: "shoresh",
    categoryName: "ירקות שורש",
    isFeatured: false,
    icon: "🧅",
    imageColor: "#f3e8ff",
    variants: [
      { id: "v-012a", label: "500 גרם", unit: "500g", priceAgorot: 390, comparePriceAgorot: null, isDefault: false },
      { id: "v-012b", label: '1 ק"ג', unit: "1kg", priceAgorot: 690, comparePriceAgorot: null, isDefault: true },
    ],
  },
  {
    id: "p-018",
    name: "שום טרי",
    slug: "shum",
    description: "שום ישראלי בעל ניחוח חזק",
    longDescription:
      "שום ישראלי טרי, ראשי שום גדולים עם שיני שום גדולות וניחוח חזק. לא מיובש ולא מעובד – טרי ישירות מהמשק. מושלם לכל מנה שצריכה שום – מרקים, ממרחים, בשרים.",
    categorySlug: "shoresh",
    categoryName: "ירקות שורש",
    isFeatured: false,
    icon: "🧄",
    imageColor: "#fefce8",
    variants: [
      { id: "v-018a", label: "ראש שום", unit: "unit", priceAgorot: 190, comparePriceAgorot: null, isDefault: true },
      { id: "v-018b", label: "צרור 6 ראשים", unit: "pack", priceAgorot: 990, comparePriceAgorot: 1140, isDefault: false },
    ],
  },
  // ── ביצים ומוצרי חלב ─────────────────────────────────────────────────────
  {
    id: "p-006",
    name: "ביצי חופש",
    slug: "beitsim-hofesh",
    description: "ביצי תרנגולות חופש, חלמון עשיר",
    longDescription:
      "ביצים מתרנגולות חופשיות שמסתובבות בחוץ ואוכלות מזון טבעי. חלמוןן כתום עמוק ועשיר בחומצות שומן אומגה 3. טעמן שונה לחלוטין מביצים מסחריות.",
    categorySlug: "beitsim",
    categoryName: "ביצים",
    isFeatured: true,
    icon: "🥚",
    imageColor: "#fef9c3",
    variants: [
      { id: "v-006a", label: "6 ביצים", unit: "pack", priceAgorot: 1390, comparePriceAgorot: null, isDefault: false },
      { id: "v-006b", label: "תריסר (12)", unit: "pack", priceAgorot: 2490, comparePriceAgorot: null, isDefault: true },
      { id: "v-006c", label: "30 ביצים", unit: "pack", priceAgorot: 5990, comparePriceAgorot: 6900, isDefault: false },
    ],
  },
  {
    id: "p-019",
    name: "גבינה לבנה",
    slug: "gvina-levana",
    description: "גבינה לבנה קרמית מחלב טרי",
    longDescription:
      "גבינה לבנה עשויה מחלב טרי ממשק, קרמית וטעימה. 5% שומן, מושלמת למריחה על לחם, לסלטים ולבישול. ללא חומרים משמרים, תאריך ייצור טרי.",
    categorySlug: "beitsim",
    categoryName: "ביצים ומוצרי חלב",
    isFeatured: false,
    icon: "🧀",
    imageColor: "#fef9c3",
    variants: [
      { id: "v-019a", label: "200 גרם", unit: "200g", priceAgorot: 890, comparePriceAgorot: null, isDefault: true },
      { id: "v-019b", label: "500 גרם", unit: "500g", priceAgorot: 1990, comparePriceAgorot: 2200, isDefault: false },
    ],
  },
  {
    id: "p-020",
    name: "יוגורט טבעי",
    slug: "yogurt",
    description: "יוגורט טבעי מחלב פרה טרי",
    longDescription:
      "יוגורט טבעי עשוי מחלב פרות חופשיות, ללא סוכר ותוספות. חמצמץ ועשיר, עם תרבויות חיידקים חיים. מצוין לאכילה עם פירות, לרטבים ולמרינדות.",
    categorySlug: "beitsim",
    categoryName: "ביצים ומוצרי חלב",
    isFeatured: false,
    icon: "🥛",
    imageColor: "#f0f9ff",
    variants: [
      { id: "v-020a", label: "150 גרם", unit: "150g", priceAgorot: 490, comparePriceAgorot: null, isDefault: true },
      { id: "v-020b", label: "500 גרם", unit: "500g", priceAgorot: 1290, comparePriceAgorot: null, isDefault: false },
    ],
  },
  // ── סלטים מוכנים ─────────────────────────────────────────────────────────
  {
    id: "p-021",
    name: "סלט כרוב ותפוחים",
    slug: "salat-kruv",
    description: "קולסלו ביתי עם תפוחי עץ",
    longDescription:
      "קולסלו ביתי עשוי מכרוב לבן וסגול, גזר מגורד, תפוחי עץ חמוצים ורוטב מיונז ביתי קל. מוכן טרי מדי יום. אינו מכיל חומרים משמרים. שלם לבשרים ולאוכל ברחוב.",
    categorySlug: "salatim",
    categoryName: "סלטים מוכנים",
    isFeatured: false,
    icon: "🥗",
    imageColor: "#f0fdf4",
    variants: [
      { id: "v-021a", label: "250 גרם", unit: "250g", priceAgorot: 890, comparePriceAgorot: null, isDefault: true },
      { id: "v-021b", label: "500 גרם", unit: "500g", priceAgorot: 1590, comparePriceAgorot: 1780, isDefault: false },
    ],
  },
  {
    id: "p-022",
    name: "חצילים קלויים",
    slug: "chatsil-kalui",
    description: "ממרח חציל שרוף ביתי",
    longDescription:
      "חצילים נצלים על אש ישירה עד שהם שרופים בחוץ ורכים בפנים, ואז מעוכים עם שמן זית, שום ולימון. ממרח עשיר ומעושן שאין כמוהו. מוכן ביום ומגיע טרי.",
    categorySlug: "salatim",
    categoryName: "סלטים מוכנים",
    isFeatured: true,
    icon: "🍆",
    imageColor: "#fae8ff",
    variants: [
      { id: "v-022a", label: "250 גרם", unit: "250g", priceAgorot: 1190, comparePriceAgorot: null, isDefault: true },
      { id: "v-022b", label: "500 גרם", unit: "500g", priceAgorot: 2090, comparePriceAgorot: 2380, isDefault: false },
    ],
  },
  {
    id: "p-025",
    name: "טחינה גולמית",
    slug: "tahina",
    description: "טחינה ממגוון בוטן נבחר",
    longDescription:
      "טחינה גולמית עשויה ממאה אחוז שומשום קלוי על ריחיים אבן. צבע בהיר ומרקם חלק במיוחד. מבסיס לכל ממרח, לחומוס, לסלט. מוכן ללא תוספות.",
    categorySlug: "salatim",
    categoryName: "סלטים מוכנים",
    isFeatured: false,
    icon: "🫙",
    imageColor: "#fef3c7",
    variants: [
      { id: "v-025a", label: "300 גרם", unit: "300g", priceAgorot: 1490, comparePriceAgorot: null, isDefault: true },
      { id: "v-025b", label: "600 גרם", unit: "600g", priceAgorot: 2690, comparePriceAgorot: 2980, isDefault: false },
    ],
  },
  // ── קטניות ───────────────────────────────────────────────────────────────
  {
    id: "p-023",
    name: "אפונה ירוקה",
    slug: "afuna",
    description: "אפונה ירוקה טרייה בתרמיל",
    longDescription:
      "אפונה ירוקה טרייה בתרמיל, מתוקה ורכה. נקטפת כשהיא צעירה ומלאה בסוכרים טבעיים. מצוינת לקיטום ואכילה חיה, לצלייה, לרטטואי ולמנות פסטה.",
    categorySlug: "ktniyot",
    categoryName: "קטניות",
    isFeatured: false,
    icon: "🫛",
    imageColor: "#dcfce7",
    variants: [
      { id: "v-023a", label: "500 גרם", unit: "500g", priceAgorot: 690, comparePriceAgorot: null, isDefault: true },
      { id: "v-023b", label: '1 ק"ג', unit: "1kg", priceAgorot: 1190, comparePriceAgorot: null, isDefault: false },
    ],
  },
  {
    id: "p-024",
    name: "תירס מתוק",
    slug: "tiras",
    description: "תירס עסיסי ומתוק",
    longDescription:
      "תירס מתוק ישראלי, קלחים גדולים ומלאים בגרגרים עסיסיים. מצוין לבישול, לצלייה על הגריל ולאכילה ישירות. מתקתקות של הקיץ.",
    categorySlug: "ktniyot",
    categoryName: "קטניות",
    isFeatured: false,
    icon: "🌽",
    imageColor: "#fef9c3",
    variants: [
      { id: "v-024a", label: "יחידה", unit: "unit", priceAgorot: 490, comparePriceAgorot: null, isDefault: true },
      { id: "v-024b", label: "3 יח׳", unit: "pack", priceAgorot: 1290, comparePriceAgorot: 1470, isDefault: false },
    ],
  },
  {
    id: "p-026",
    name: "שעועית ירוקה",
    slug: "shuvalit",
    description: "שעועית גינה פריכה וטרייה",
    longDescription:
      "שעועית ירוקה גינה פריכה, קלה לבישול ועשירה בחלבון וסיבים. נקטפת בגיל צעיר לפריכות מרבית. מצוינת לתבשילים, לצלייה ולסלטים חמים.",
    categorySlug: "ktniyot",
    categoryName: "קטניות",
    isFeatured: false,
    icon: "🫘",
    imageColor: "#d1fae5",
    variants: [
      { id: "v-026a", label: "500 גרם", unit: "500g", priceAgorot: 590, comparePriceAgorot: null, isDefault: true },
      { id: "v-026b", label: '1 ק"ג', unit: "1kg", priceAgorot: 1090, comparePriceAgorot: null, isDefault: false },
    ],
  },
  // ── מיצים טבעיים ─────────────────────────────────────────────────────────
  {
    id: "p-027",
    name: "מיץ תפוזים טרי",
    slug: "mits-tapuzim",
    description: "מיץ תפוזים סחוט טרי ביום",
    longDescription:
      "מיץ תפוזים 100% טבעי, נסחט ביום הייצור מתפוזים ישראליים עסיסיים. ללא תוספות, ללא סוכר, ללא מים. כתום, מתוק ומלא בויטמין C. שלם לבוקר ולאורך היום.",
    categorySlug: "mitsim",
    categoryName: "מיצים טבעיים",
    isFeatured: true,
    icon: "🍊",
    imageColor: "#ffedd5",
    variants: [
      { id: "v-027a", label: "500 מ\"ל", unit: "500ml", priceAgorot: 1490, comparePriceAgorot: null, isDefault: true },
      { id: "v-027b", label: "1 ליטר", unit: "1L", priceAgorot: 2490, comparePriceAgorot: 2980, isDefault: false },
    ],
  },
  {
    id: "p-028",
    name: "מיץ גזר ותפוח",
    slug: "mits-gezer",
    description: "מיץ גזר ותפוח סחוט קר",
    longDescription:
      "מיץ גזר ותפוח עץ, נסחט קר לשמירת כל הוויטמינים. מתוק באופן טבעי, עשיר בבטא קרוטן ואנטי-אוקסידנטים. ללא תוספות סוכר או חומרים משמרים.",
    categorySlug: "mitsim",
    categoryName: "מיצים טבעיים",
    isFeatured: false,
    icon: "🥕",
    imageColor: "#fef3c7",
    variants: [
      { id: "v-028a", label: "500 מ\"ל", unit: "500ml", priceAgorot: 1290, comparePriceAgorot: null, isDefault: true },
      { id: "v-028b", label: "1 ליטר", unit: "1L", priceAgorot: 2290, comparePriceAgorot: null, isDefault: false },
    ],
  },
  {
    id: "p-029",
    name: "מיץ תפוחים",
    slug: "mits-tapuchim",
    description: "מיץ תפוחים ירוקים טרי",
    longDescription:
      "מיץ תפוחים ירוקים גרנד סמית, נסחט קר לצבע ירוק-זהוב מרהיב וטעם חמוץ-מתוק מרענן. עשיר בפוליפנולים. שלם לשתייה קרה עם קוביות קרח.",
    categorySlug: "mitsim",
    categoryName: "מיצים טבעיים",
    isFeatured: false,
    icon: "🍏",
    imageColor: "#ecfdf5",
    variants: [
      { id: "v-029a", label: "500 מ\"ל", unit: "500ml", priceAgorot: 1390, comparePriceAgorot: null, isDefault: true },
      { id: "v-029b", label: "1 ליטר", unit: "1L", priceAgorot: 2490, comparePriceAgorot: 2780, isDefault: false },
    ],
  },
];

export const FEATURED_PRODUCTS = MOCK_PRODUCTS.filter((p) => p.isFeatured);

// ─── Delivery zones (summary) ──────────────────────────────────────────────

export const MOCK_ZONES = [
  { name: "מרכז - מקומי", details: "ראשון לציון, רחובות, נס ציונה, מודיעין", fee: 1000, freeFrom: 15000, days: "א׳–ו׳" },
  { name: "אזור השרון", details: "כפר סבא, הוד השרון, רעננה, נתניה", fee: 1500, freeFrom: 20000, days: "א׳–ה׳" },
  { name: "גוש דן", details: "תל אביב, רמת גן, פתח תקווה, חולון", fee: 2000, freeFrom: 25000, days: "א׳–ה׳" },
  { name: "ירושלים והסביבה", details: "ירושלים, מעלה אדומים, בית שמש", fee: 2500, freeFrom: 30000, days: "שני, רביעי" },
  { name: "חיפה והקריות", details: "חיפה, קריות, עכו, נהריה", fee: 2000, freeFrom: 25000, days: "שני, חמישי" },
  { name: "אזור הדרום", details: "באר שבע, אשדוד, אשקלון", fee: 3000, freeFrom: 35000, days: "שלישי" },
];
