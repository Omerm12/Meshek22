import type { Metadata } from "next";
import { MapPin, Truck, Clock, CheckCircle2, Info, CalendarDays, PackageCheck, RefreshCw, MessageCircle } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { DELIVERY_ZONES } from "@/lib/delivery";
import { SETTLEMENTS } from "@/lib/data/settlements";
import { formatPrice } from "@/lib/utils/money";

export const metadata: Metadata = {
  title: "אזורי משלוח | משק 22",
  description:
    "אנחנו מגיעים לעשרות יישובים ברחבי ישראל. בדקו האם אנחנו מגיעים לאזור שלכם, מה דמי המשלוח ומהי ההזמנה המינימלית.",
};

// Group settlements by zone slug
const SETTLEMENTS_BY_ZONE: Record<string, string[]> = {};
for (const s of SETTLEMENTS) {
  if (!SETTLEMENTS_BY_ZONE[s.zone]) SETTLEMENTS_BY_ZONE[s.zone] = [];
  SETTLEMENTS_BY_ZONE[s.zone].push(s.name);
}

const ZONE_ICONS: Record<string, string> = {
  "zone-center":    "🏙️",
  "zone-gush-dan":  "🌆",
  "zone-central":   "🌄",
  "zone-jerusalem": "🕌",
  "zone-north":     "⛰️",
  "zone-south":     "🌵",
};

export default function DeliveryAreasPage() {
  const zones = Object.values(DELIVERY_ZONES);

  return (
    <main className="flex-1">

      {/* Hero */}
      <div className="bg-gradient-to-b from-sky-700 to-sky-600 text-white py-14 lg:py-20">
        <Container>
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 bg-white/15 border border-white/20 rounded-full px-3 py-1.5 mb-4 text-sm font-semibold text-sky-100">
              <Truck className="h-3.5 w-3.5" aria-hidden="true" />
              אזורי משלוח
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-4">
              מגיעים לכל הארץ
            </h1>
            <p className="text-sky-100 text-lg leading-relaxed">
              משלוח ישירות מהמשק לביתכם – ברחבי ישראל.
              בחרו את האזור שלכם וראו את התנאים המלאים.
            </p>
          </div>
        </Container>
      </div>

      {/* Quick facts bar */}
      <div className="bg-white border-b border-stone-100">
        <Container>
          <div className="py-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            {[
              { icon: Clock,        text: "עד 24 שעות באזורי גוש דן" },
              { icon: CheckCircle2, text: "משלוח חינם מהזמנה מינימלית" },
              { icon: MapPin,       text: "80+ יישובים ברחבי ישראל" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 text-stone-600">
                <div className="h-7 w-7 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                  <Icon className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
                </div>
                {text}
              </div>
            ))}
          </div>
        </Container>
      </div>

      {/* Zone cards */}
      <div className="py-12 lg:py-16" style={{ backgroundColor: "var(--color-surface)" }}>
        <Container>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">אזורי משלוח ותנאים</h2>
          <p className="text-stone-500 mb-8">
            לחצו על אזור כדי לראות את כל היישובים הכלולים.
          </p>

          <div className="space-y-4">
            {zones.map((zone) => {
              const settlements = SETTLEMENTS_BY_ZONE[zone.slug] ?? [];
              const isFree = zone.baseFeeAgorot === 0;

              return (
                <details
                  key={zone.slug}
                  className="group bg-white rounded-2xl border border-stone-100 overflow-hidden hover:border-brand-200 transition-colors"
                >
                  <summary className="flex items-center gap-4 p-5 cursor-pointer list-none select-none">
                    {/* Zone icon */}
                    <div className="h-11 w-11 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center text-xl shrink-0">
                      {ZONE_ICONS[zone.slug] ?? "📍"}
                    </div>

                    {/* Name + fee */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-gray-900">{zone.name}</h3>
                        {isFree && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                            ללא דמי משלוח
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-400 mt-0.5">
                        {settlements.length} יישובים · {zone.estimatedDays}
                      </p>
                    </div>

                    {/* Key numbers */}
                    <div className="hidden sm:flex items-center gap-6 shrink-0 text-sm">
                      <div className="text-end">
                        <p className="font-bold text-gray-900">
                          {isFree ? "חינם" : formatPrice(zone.baseFeeAgorot)}
                        </p>
                        <p className="text-xs text-stone-400">דמי משלוח</p>
                      </div>
                      <div className="text-end">
                        <p className="font-bold text-gray-900">
                          {formatPrice(zone.minOrderAgorot)}
                        </p>
                        <p className="text-xs text-stone-400">מינימום</p>
                      </div>
                      {zone.freeThrsholdAgorot && (
                        <div className="text-end">
                          <p className="font-bold text-emerald-600">
                            {formatPrice(zone.freeThrsholdAgorot)}
                          </p>
                          <p className="text-xs text-stone-400">לחינם</p>
                        </div>
                      )}
                    </div>

                    {/* Chevron */}
                    <svg
                      className="h-5 w-5 text-stone-400 shrink-0 transition-transform duration-200 group-open:rotate-180"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>

                  {/* Expanded content */}
                  <div className="border-t border-stone-100 px-5 pb-5 pt-4">
                    {/* Mobile numbers */}
                    <div className="sm:hidden grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-stone-50 rounded-xl p-3 text-center">
                        <p className="font-bold text-gray-900 text-sm">
                          {isFree ? "חינם" : formatPrice(zone.baseFeeAgorot)}
                        </p>
                        <p className="text-xs text-stone-400">משלוח</p>
                      </div>
                      <div className="bg-stone-50 rounded-xl p-3 text-center">
                        <p className="font-bold text-gray-900 text-sm">
                          {formatPrice(zone.minOrderAgorot)}
                        </p>
                        <p className="text-xs text-stone-400">מינימום</p>
                      </div>
                      {zone.freeThrsholdAgorot ? (
                        <div className="bg-emerald-50 rounded-xl p-3 text-center">
                          <p className="font-bold text-emerald-600 text-sm">
                            {formatPrice(zone.freeThrsholdAgorot)}
                          </p>
                          <p className="text-xs text-stone-400">לחינם</p>
                        </div>
                      ) : (
                        <div className="bg-stone-50 rounded-xl p-3 text-center">
                          <p className="font-bold text-stone-400 text-sm">—</p>
                          <p className="text-xs text-stone-400">לחינם</p>
                        </div>
                      )}
                    </div>

                    {/* Condition pills */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="inline-flex items-center gap-1.5 text-xs text-stone-600 bg-stone-50 border border-stone-200 rounded-full px-3 py-1">
                        <Clock className="h-3 w-3 text-brand-500" />
                        {zone.estimatedDays}
                      </span>
                      {!isFree && zone.freeThrsholdAgorot && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                          <Truck className="h-3 w-3" />
                          משלוח חינם מ-{formatPrice(zone.freeThrsholdAgorot)}
                        </span>
                      )}
                      {!zone.freeThrsholdAgorot && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-stone-500 bg-stone-50 border border-stone-200 rounded-full px-3 py-1">
                          <Info className="h-3 w-3" />
                          אין אפשרות למשלוח חינם באזור זה
                        </span>
                      )}
                    </div>

                    {/* Settlements list */}
                    {settlements.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
                          יישובים ({settlements.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {settlements.map((s) => (
                            <span
                              key={s}
                              className="text-xs text-stone-600 bg-stone-50 border border-stone-200 rounded-full px-2.5 py-1"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>

          {/* Not in the list CTA */}
          <div className="mt-10 bg-white rounded-2xl border border-stone-100 p-6 text-center">
            <MapPin className="h-8 w-8 text-stone-300 mx-auto mb-3" aria-hidden="true" />
            <h3 className="font-bold text-gray-900 mb-1">לא מצאתם את היישוב שלכם?</h3>
            <p className="text-sm text-stone-500 mb-4 max-w-sm mx-auto">
              אנחנו מרחיבים את אזורי המשלוח כל הזמן. צרו קשר ונבדוק יחד.
            </p>
            <a
              href="tel:*3722"
              className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors"
            >
              <Truck className="h-4 w-4" />
              דברו איתנו: *3722
            </a>
          </div>
        </Container>
      </div>

      {/* Delivery policy section */}
      <div className="py-12 lg:py-16 bg-white border-t border-stone-100">
        <Container>
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">מדיניות ולוח זמנים</h2>
            <p className="text-stone-500 mb-8">כל מה שצריך לדעת לפני שמזמינים.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {[
                {
                  icon: CalendarDays,
                  title: "ימי משלוח",
                  body: "משלוחים מתבצעים ימים א׳ עד ה׳. אין משלוחים בשישי, שבת ובחגים.",
                  bg: "#f0fdf4",
                  iconClass: "text-brand-600",
                },
                {
                  icon: Clock,
                  title: "שעת הגשת הזמנה",
                  body: "הזמינו עד 22:00 ותקבלו את המשלוח ביום העסקים הבא. הזמנות שהוגשו לאחר 22:00 יצאו יום לאחר מכן.",
                  bg: "#e0f2fe",
                  iconClass: "text-sky-600",
                },
                {
                  icon: PackageCheck,
                  title: "קבלת המשלוח",
                  body: "תקבלו SMS בבוקר יום המשלוח עם חלון זמנים משוער. לא הייתם בבית? ניצור איתכם קשר לתיאום מחדש ללא תוספת עלות.",
                  bg: "#d1fae5",
                  iconClass: "text-emerald-600",
                },
                {
                  icon: RefreshCw,
                  title: "מוצר פגום? מחליפים",
                  body: "מוצר שהגיע פגום, נובל מוקדם מהרגיל, או שאינו לשביעות רצונכם — החלפה מיידית ללא שאלות ב-24 השעות הבאות.",
                  bg: "#fef3c7",
                  iconClass: "text-amber-600",
                },
              ].map(({ icon: Icon, title, body, bg, iconClass }) => (
                <div
                  key={title}
                  className="bg-stone-50 rounded-2xl border border-stone-100 p-5"
                >
                  <div
                    className="h-9 w-9 rounded-xl flex items-center justify-center mb-3"
                    style={{ backgroundColor: bg }}
                  >
                    <Icon className={`h-5 w-5 ${iconClass}`} aria-hidden="true" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1 text-sm">{title}</h3>
                  <p className="text-sm text-stone-500 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>

            {/* FAQ-style notes */}
            <div className="bg-brand-50 border border-brand-100 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <MessageCircle className="h-4 w-4 text-brand-600 shrink-0" />
                <h3 className="font-semibold text-brand-800 text-sm">שאלות נפוצות</h3>
              </div>
              <ul className="space-y-3 text-sm text-brand-700">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand-500 shrink-0 mt-0.5" aria-hidden="true" />
                  <span><strong>האם אפשר לבטל הזמנה?</strong> ניתן לבטל עד 6 שעות לפני יציאת המשלוח. צרו קשר בטלפון *3722 או בדוא"ל.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand-500 shrink-0 mt-0.5" aria-hidden="true" />
                  <span><strong>האם ניתן לשנות כתובת?</strong> כן, עד יום לפני המשלוח — בתנאי שהכתובת באותו אזור משלוח.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand-500 shrink-0 mt-0.5" aria-hidden="true" />
                  <span><strong>מה קורה בחגים?</strong> לפני חגים גדולים נשלחת הודעה מוקדמת עם עדכון לוח הזמנים.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand-500 shrink-0 mt-0.5" aria-hidden="true" />
                  <span><strong>מגיעים גם לישובים קטנים?</strong> ברוב המקרים כן. אם לא מצאתם את הישוב שלכם ברשימה, <a href="tel:*3722" className="underline">התקשרו אלינו</a>.</span>
                </li>
              </ul>
            </div>
          </div>
        </Container>
      </div>

    </main>
  );
}
