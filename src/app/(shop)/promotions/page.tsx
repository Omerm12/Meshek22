import type { Metadata } from "next";
import { Tag, Sparkles, ArrowLeft, Truck } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { CategoryHero } from "@/components/shop/CategoryHero";
import { getCategoryHero } from "@/lib/config/category-heroes";

export const metadata: Metadata = {
  title: "מבצעים | משק 22",
  description: "חבילות חיסכון, מבצעי השבוע ומוצרי עונה במחיר מיוחד – ישירות ממשק 22.",
};

const WEEKLY_DEALS = [
  {
    id: "w1",
    tag: "מארז שבועי",
    title: "סל ירקות לשבוע",
    desc: "עגבנייה שרי, מלפפון, פלפל אדום וירוק, חסה, גזר, בצל ושום – כמות שמספיקה לשבוע שלם לזוג.",
    price: 4990,
    oldPrice: 6200,
    savingPct: 20,
    icon: "🥗",
    accent: { bg: "bg-emerald-50", border: "border-emerald-200", badge: "bg-emerald-100 text-emerald-700" },
    tag2: "הכי פופולרי",
  },
  {
    id: "w2",
    tag: "מארז פירות",
    title: "פירות עונתיים טריים",
    desc: "תפוחים, אבוקדו, תותי שדה ומנגו – הכל לפי עונה, הכל ישר מהעץ.",
    price: 5990,
    oldPrice: 7500,
    savingPct: 20,
    icon: "🍎",
    accent: { bg: "bg-orange-50", border: "border-orange-200", badge: "bg-orange-100 text-orange-700" },
    tag2: null,
  },
  {
    id: "w3",
    tag: "עשבי תיבול",
    title: "5 צרורות תיבול",
    desc: "פטרוזיליה, כוסברה, נענע, בזיליקום ושמיר – טריים ועטופים יפה.",
    price: 1890,
    oldPrice: 2500,
    savingPct: 25,
    icon: "🌿",
    accent: { bg: "bg-teal-50", border: "border-teal-200", badge: "bg-teal-100 text-teal-700" },
    tag2: null,
  },
  {
    id: "w4",
    tag: "מארז משפחתי",
    title: "ירקות ופירות X-Large",
    desc: "כמות כפולה, מגוון רחב – מתאים לבית עם ילדים. כולל ירקות בישול ופירות לנשנוש.",
    price: 8900,
    oldPrice: 11500,
    savingPct: 23,
    icon: "🏡",
    accent: { bg: "bg-sky-50", border: "border-sky-200", badge: "bg-sky-100 text-sky-700" },
    tag2: "חיסכון מקסימלי",
  },
  {
    id: "w5",
    tag: "סלט ביתי",
    title: "ערכת סלט ישראלי",
    desc: "עגבנייה, מלפפון, פלפל, בצל סגול, לימון ועלי נענע – הכל לסלט הישראלי הקלאסי.",
    price: 2990,
    oldPrice: 3800,
    savingPct: 21,
    icon: "🥙",
    accent: { bg: "bg-yellow-50", border: "border-yellow-200", badge: "bg-yellow-100 text-yellow-700" },
    tag2: null,
  },
  {
    id: "w6",
    tag: "בריאות",
    title: "מארז ירוקים",
    desc: "תרד, מנגולד, ברוקולי, כרוב ניצנים וחסה – להכנת שייק ירוק, מוקפץ או מרק.",
    price: 3490,
    oldPrice: 4500,
    savingPct: 22,
    icon: "💪",
    accent: { bg: "bg-lime-50", border: "border-lime-200", badge: "bg-lime-100 text-lime-700" },
    tag2: null,
  },
];

const BUNDLES = [
  {
    id: "b1",
    title: "מנוי שבועי – חיסכון מקסימלי",
    desc: "הזמינו כל שבוע, שלמו פחות. מינוי שבועי נשמר לכם עם אותם מוצרים ואפשרות שינוי עד 48 שעות לפני המשלוח.",
    highlight: "חיסכון 15% על כל הזמנה",
    icon: "🔁",
    comingSoon: true,
  },
  {
    id: "b2",
    title: "מארז לאירוח",
    desc: "שולחן מלא לשבת, לחג או לאירוע משפחתי. כולל ירקות, פירות, עשבי תיבול ועלים לסלט לעשרה סועדים.",
    highlight: "מספיק ל-10 איש",
    icon: "🎉",
    comingSoon: false,
  },
];

function formatShekels(agorot: number) {
  return `₪${(agorot / 100).toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PromotionsPage() {
  const hero = getCategoryHero("sale");

  return (
    <main className="flex-1" style={{ backgroundColor: "var(--color-surface)" }}>

      {/* Hero banner */}
      <CategoryHero config={hero} />

      {/* Weekly deals grid */}
      <Container className="py-12 lg:py-16">
        <div className="flex items-end justify-between mb-8 gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-red-50 rounded-full px-3 py-1 mb-2">
              <Tag className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />
              <span className="text-xs font-semibold text-red-600">מבצעי השבוע</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              חבילות חיסכון שבועיות
            </h2>
            <p className="text-base text-stone-500 mt-1">מוחלפות כל שבוע לפי עונה ומלאי</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {WEEKLY_DEALS.map((deal) => (
            <div
              key={deal.id}
              className={`group relative h-full rounded-2xl ${deal.accent.bg} border ${deal.accent.border} p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300`}
            >
              {/* Popular badge */}
              {deal.tag2 && (
                <div className="absolute -top-2 start-4">
                  <span className="inline-flex items-center gap-1 bg-red-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full shadow-sm">
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    {deal.tag2}
                  </span>
                </div>
              )}

              {/* Top row */}
              <div className="flex items-start justify-between mb-4">
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${deal.accent.badge}`}>
                  <Tag className="h-3 w-3" aria-hidden="true" />
                  {deal.tag}
                </span>
                <span
                  className="text-4xl transition-transform duration-300 group-hover:scale-110 select-none leading-none"
                  aria-hidden="true"
                >
                  {deal.icon}
                </span>
              </div>

              <h3 className="font-bold text-gray-900 text-lg mb-1.5">{deal.title}</h3>
              <p className="text-base text-stone-500 leading-relaxed mb-5">{deal.desc}</p>

              {/* Price */}
              <div className="flex items-baseline gap-2 mb-5">
                <span className="text-[26px] font-bold text-gray-900 leading-none">
                  {formatShekels(deal.price)}
                </span>
                <span className="text-sm text-stone-400 line-through">
                  {formatShekels(deal.oldPrice)}
                </span>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-3">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${deal.accent.badge}`}>
                  חיסכון {deal.savingPct}%
                </span>
                <a
                  href="/category/yerakot"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800 transition-colors"
                >
                  לסל הקניות
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Bundle section */}
        <div className="mt-14">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">חבילות מיוחדות</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {BUNDLES.map((bundle) => (
              <div
                key={bundle.id}
                className="relative bg-white rounded-2xl border border-stone-100 p-6 hover:border-brand-200 hover:shadow-md transition-all duration-300"
              >
                {bundle.comingSoon && (
                  <div className="absolute -top-2 start-4">
                    <span className="inline-flex bg-stone-700 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                      בקרוב
                    </span>
                  </div>
                )}
                <div className="flex items-start gap-4">
                  <div className="text-4xl leading-none select-none shrink-0">{bundle.icon}</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 mb-1">{bundle.title}</h3>
                    <p className="text-sm text-stone-500 leading-relaxed mb-3">
                      {bundle.desc}
                    </p>
                    <span className="inline-block text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-100 rounded-full px-3 py-1">
                      {bundle.highlight}
                    </span>
                  </div>
                </div>
                {!bundle.comingSoon && (
                  <div className="mt-4 pt-4 border-t border-stone-100">
                    <a
                      href="/category/yerakot"
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800 transition-colors"
                    >
                      הזמינו עכשיו
                      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <p className="text-stone-500 text-sm mb-4">
            לא מצאתם את מה שחיפשתם? עיינו בכל המוצרים שלנו
          </p>
          <a
            href="/category/yerakot"
            className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors shadow-sm"
          >
            לכל הירקות והפירות
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </Container>
    </main>
  );
}
