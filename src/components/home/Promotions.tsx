import { Tag, ArrowLeft, Sparkles } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";

const DEALS = [
  {
    id: 1,
    tag: "מארז שבועי",
    title: "סל ירקות שבועי",
    desc: "עגבנייה, מלפפון, פלפל, חסה, גזר ועוד – לכל השבוע.",
    price: "₪49.90",
    oldPrice: "₪62.00",
    saving: "חיסכון 20%",
    accent: { bg: "bg-emerald-50", border: "border-emerald-100", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-400" },
    icon: "🥗",
  },
  {
    id: 2,
    tag: "מארז פירות",
    title: "מארז פירות עונתיים",
    desc: "תפוחים, אבוקדו, תותי שדה ומנגו – עסיסי ורענן.",
    price: "₪59.90",
    oldPrice: "₪75.00",
    saving: "חיסכון 20%",
    accent: { bg: "bg-orange-50", border: "border-orange-100", badge: "bg-orange-100 text-orange-700", dot: "bg-orange-400" },
    icon: "🍎",
  },
  {
    id: 3,
    tag: "חבילת עשבים",
    title: "עשבי תיבול טריים",
    desc: "פטרוזיליה, כוסברה, נענע, בזיליקום ושמיר.",
    price: "₪18.90",
    oldPrice: "₪25.00",
    saving: "חיסכון 25%",
    accent: { bg: "bg-teal-50", border: "border-teal-100", badge: "bg-teal-100 text-teal-700", dot: "bg-teal-400" },
    icon: "🌿",
  },
];

export function Promotions() {
  return (
    <section className="py-16 lg:py-20 bg-white" aria-labelledby="promos-title">
      <Container>
        <div className="flex items-end justify-between mb-10 gap-4">
          <Reveal>
            <div>
              <div className="inline-flex items-center gap-1.5 bg-red-50 rounded-full px-3 py-1 mb-3">
                <Sparkles className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />
                <span className="text-xs font-semibold text-red-600">מבצעים מיוחדים</span>
              </div>
              <h2 id="promos-title" className="text-3xl font-bold text-gray-900 sm:text-4xl">
                חבילות חיסכון
              </h2>
              <p className="text-lg text-stone-500 mt-1.5">קנו יותר, חסכו יותר</p>
            </div>
          </Reveal>
          <a
            href="/promotions"
            className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800 transition-colors shrink-0"
          >
            כל המבצעים
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {DEALS.map((deal, i) => (
            <Reveal key={deal.id} delay={i * 80}>
              <div
                className={`group relative h-full rounded-2xl ${deal.accent.bg} border ${deal.accent.border} p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300`}
              >
                {/* Top row */}
                <div className="flex items-start justify-between mb-5">
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
                <p className="text-base text-stone-500 leading-relaxed mb-6">{deal.desc}</p>

                {/* Price row */}
                <div className="flex items-baseline gap-2 mb-5">
                  <span className="text-[26px] font-bold text-gray-900 leading-none">{deal.price}</span>
                  <span className="text-sm text-stone-400 line-through">{deal.oldPrice}</span>
                </div>

                {/* Saving badge + CTA */}
                <div className="flex items-center justify-between gap-3">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${deal.accent.badge}`}>
                    {deal.saving}
                  </span>
                  <button className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800 transition-colors cursor-pointer">
                    הוסיפו לסל
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
