import { Clock } from "lucide-react";
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
    desc: "תשלום מאובטח בכרטיס אשראי, Apple Pay או Google Pay.",
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
      className="py-16 lg:py-24 bg-white"
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-7">
          {STEPS.map(({ num, emoji, title, desc }, i) => (
            <Reveal key={num} delay={i * 80}>
              <div className="relative h-full bg-white rounded-2xl p-7 lg:p-8 border border-stone-100 hover:border-brand-200 hover:shadow-md transition-all duration-300">
                <span
                  className="absolute top-5 end-6 text-6xl font-black text-stone-50 select-none leading-none"
                  aria-hidden="true"
                >
                  {num}
                </span>

                <div className="relative h-18 w-18 rounded-2xl bg-brand-50 flex items-center justify-center text-4xl mb-6" style={{ height: "4.5rem", width: "4.5rem" }}>
                  <span aria-hidden="true">{emoji}</span>
                  <span className="absolute -top-2 -end-2 h-6 w-6 bg-brand-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {i + 1}
                  </span>
                </div>

                <h3 className="font-bold text-gray-900 text-xl mb-3">{title}</h3>
                <p className="text-base text-stone-500 leading-relaxed">{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Delivery timing callout */}
        <Reveal>
          <div className="mt-10 lg:mt-14 bg-brand-600 rounded-2xl p-7 lg:p-10 text-white text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Clock className="h-7 w-7 shrink-0" aria-hidden="true" />
              <h3 className="text-2xl lg:text-3xl font-bold">מועדי משלוח</h3>
            </div>
            <p className="text-lg lg:text-xl font-semibold leading-relaxed mb-2">
              הזמנות שהתקבלו לפני השעה 12:00 — יסופקו באותו יום עסקים
            </p>
            <p className="text-lg lg:text-xl font-semibold leading-relaxed opacity-90">
              הזמנות שהתקבלו לאחר השעה 12:00 — יסופקו ביום העסקים הבא
            </p>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
