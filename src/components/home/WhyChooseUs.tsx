import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";

const REASONS = [
  {
    emoji: "🌱",
    title: "ישירות מהמשק",
    desc: "אין מתווכים, אין אחסון ממושך. מהשדה לאריזה, מהאריזה אליכם.",
  },
  {
    emoji: "🔍",
    title: "בקרת איכות קפדנית",
    desc: "כל מוצר עובר בדיקה. אנחנו לא שולחים משהו שלא נאכל בעצמנו.",
  },
  {
    emoji: "🤝",
    title: "תמיכה בחקלאות מקומית",
    desc: "כל קנייה תומכת ישירות בחקלאים ישראלים.",
  },
  {
    emoji: "♻️",
    title: "ידידותי לסביבה",
    desc: "אריזות ממוחזרות ומינימום בזבוז – כי לנו אכפת.",
  },
];

export function WhyChooseUs() {
  return (
    <section
      className="py-16 lg:py-20 bg-white"
      aria-labelledby="why-title"
    >
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

          {/* Left: headline + stat */}
          <Reveal>
            <div>
              <p className="text-xs font-semibold text-brand-600 uppercase tracking-widest mb-3">
                למה משק 22
              </p>
              <h2
                id="why-title"
                className="text-3xl sm:text-4xl font-bold text-gray-900 mb-5 leading-tight"
              >
                לא רק חנות –<br />
                <span className="text-brand-600">המשק הדיגיטלי שלכם</span>
              </h2>
              <p className="text-stone-500 leading-relaxed mb-8 text-lg">
                אנחנו מחברים אתכם ישירות לשדה. ירקות שנקטפו הבוקר מגיעים אליכם בערב, בלי ביניים.
              </p>

              {/* Stat row */}
              <div className="flex flex-wrap gap-8">
                {[
                  { num: "5,000+", label: "לקוחות מרוצים" },
                  { num: "4.9★", label: "דירוג ממוצע" },
                  { num: "3+", label: "שנות פעילות" },
                ].map(({ num, label }) => (
                  <div key={label}>
                    <p className="text-3xl font-bold text-brand-700 leading-none">{num}</p>
                    <p className="text-sm text-stone-400 mt-1">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Right: reason cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {REASONS.map(({ emoji, title, desc }, i) => (
              <Reveal key={title} delay={i * 70}>
                <div className="group h-full p-5 rounded-2xl border border-stone-100 bg-stone-50 hover:border-brand-200 hover:bg-brand-50 transition-all duration-300">
                  <div className="h-10 w-10 rounded-xl bg-white border border-stone-100 flex items-center justify-center text-xl mb-3 group-hover:border-brand-200 transition-colors">
                    <span aria-hidden="true">{emoji}</span>
                  </div>
                  <h3 className="font-bold text-gray-900 text-base mb-1.5">{title}</h3>
                  <p className="text-sm text-stone-500 leading-relaxed">{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
