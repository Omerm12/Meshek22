import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Reveal } from "@/components/ui/Reveal";

const STEPS = [
  {
    num: "01",
    emoji: "🛒",
    title: "בחרו מוצרים",
    desc: "עיינו בקטלוג, בחרו מה שאוהבים וסננו לפי קטגוריה.",
  },
  {
    num: "02",
    emoji: "📍",
    title: "בחרו זמן ומיקום",
    desc: "בחרו תאריך ואזור משלוח נוח – מגיעים עד לדלת.",
  },
  {
    num: "03",
    emoji: "💳",
    title: "שלמו בבטחה",
    desc: "תשלום מאובטח בכרטיס, Bit או PayPal.",
  },
  {
    num: "04",
    emoji: "🌿",
    title: "קבלו טרי מהמשק",
    desc: "הירקות מגיעים ארוזים בקפידה, טריים ממש.",
  },
];

export function HowItWorks() {
  return (
    <section
      className="py-16 lg:py-24"
      style={{ backgroundColor: "var(--color-surface-2)" }}
      aria-labelledby="how-it-works-title"
    >
      <Container>
        <Reveal>
          <SectionTitle
            id="how-it-works-title"
            title="איך זה עובד?"
            subtitle="ארבעה צעדים פשוטים מהבחירה עד לדלת"
            centered
            className="mb-14"
          />
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {STEPS.map(({ num, emoji, title, desc }, i) => (
            <Reveal key={num} delay={i * 80}>
              <div className="relative h-full bg-white rounded-2xl p-6 border border-stone-100 hover:border-brand-200 hover:shadow-md transition-all duration-300">
                {/* Step number — subtle background text */}
                <span
                  className="absolute top-4 end-5 text-5xl font-black text-stone-50 select-none leading-none"
                  aria-hidden="true"
                >
                  {num}
                </span>

                {/* Icon */}
                <div className="relative h-14 w-14 rounded-2xl bg-brand-50 flex items-center justify-center text-3xl mb-5">
                  <span aria-hidden="true">{emoji}</span>
                  {/* Step badge */}
                  <span className="absolute -top-1.5 -end-1.5 h-5 w-5 bg-brand-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {i + 1}
                  </span>
                </div>

                <h3 className="font-bold text-gray-900 text-base mb-1.5">{title}</h3>
                <p className="text-sm text-stone-500 leading-relaxed">{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
