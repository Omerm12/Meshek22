import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  Leaf,
  Heart,
  Star,
  Truck,
  Phone,
  Mail,
  ArrowLeft,
  CheckCircle2,
  MapPin,
} from "lucide-react";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "אודות משק 22",
  description:
    "משק 22, בבעלותו של חגי מעודי, ממוקם במושב ינון. גידול ושיווק תוצרת חקלאית איכותית — ישירות מהשדה אל הלקוח.",
};

const VALUES = [
  {
    icon: Leaf,
    title: "ישירות מהשדה",
    desc: "אין פערי תיווך. אתם מקבלים תוצרת ישירות מהחקלאי — כל פרי וכל ירק נבחרים בקפידה להבטחת חוויית קנייה מיטבית.",
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    icon: Star,
    title: "איכות ללא פשרות",
    desc: "כל אצווה עוברת מיון ידני. הטריות היומיומית היא חלק בלתי נפרד מהעשייה שלנו — אנו מקפידים על איכות גבוהה ובחירה קפדנית.",
    color: "bg-amber-50 text-amber-600",
  },
  {
    icon: Heart,
    title: "שירות אישי ומותאם",
    desc: "הקשר הישיר עם הלקוח מאפשר שירות אישי ומותאם לצרכים שונים. אנחנו עסק של אנשים — לא תאגיד.",
    color: "bg-rose-50 text-rose-600",
  },
  {
    icon: Truck,
    title: "אספקה סדירה ואמינה",
    desc: "אנו מספקים מענה ללקוחות פרטיים וגם ללקוחות מוסדיים הזקוקים לאספקה סדירה. אנו מקפידים על זמינות ונוחות, כולל אפשרות למשלוחים.",
    color: "bg-sky-50 text-sky-600",
  },
];

const COMMITMENTS = [
  "תוצרת טרייה יומיומית — קטיפים שוטפים ישירות מהשדה",
  "מחירים שקופים ויציבים, ללא הפתעות בקופה",
  "שירות אישי ומותאם — ניתן תמיד לעדכן הזמנה לפני אספקה",
  "אספקה סדירה ואמינה ללקוחות פרטיים ומוסדיים כאחד",
];

export default function AboutPage() {
  return (
    <main className="flex-1">
      {/* Hero */}
      <div className="relative bg-brand-800 text-white py-16 lg:py-24 overflow-hidden">
        <Image
          src="/images/heroes/photo-meshek2.png"
          alt=""
          fill
          className="object-cover opacity-40"
          priority
          aria-hidden="true"
        />
        <Container className="relative z-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 bg-white/15 border border-white/20 rounded-full px-3 py-1.5 mb-4 text-sm font-semibold text-brand-100">
              <Leaf className="h-3.5 w-3.5" aria-hidden="true" />
              הסיפור שלנו
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold mb-5 leading-tight">
              חקלאות ישראלית<br />ישירות מהשדה אליכם
            </h1>
            <p className="text-brand-100 text-xl leading-relaxed">
              משק 22, בבעלותו של חגי מעודי, ממוקם במושב ינון ופועל מתוך אהבה
              אמיתית לאדמה ולחקלאות הישראלית.
            </p>
          </div>
        </Container>
      </div>

      {/* Story section */}
      <div className="py-14 lg:py-20 bg-white">
        <Container>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Story text */}
            <div className="space-y-6 text-stone-600 leading-relaxed">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
                  מי אנחנו
                </h2>
                <p>
                  משק 22 מתמחה בגידול ושיווק תוצרת חקלאית איכותית לשוק המוסדי
                  והפרטי כאחד. בכל יום אנו מגדלים פירות וירקות טריים ומובחרים,
                  תוך הקפדה על איכות גבוהה ובחירה קפדנית של כל תוצרת.
                </p>
                <p className="mt-3">
                  החזון שלנו הוא לספק תוצרת חקלאית ישראלית, טרייה ואיכותית —
                  ישירות מהשדה אל הלקוח. אנו מאמינים בחקלאות כחול-לבן וגאים
                  להיות חלק מהעשייה המקומית בישראל 🇮🇱.
                </p>
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
                  הגישה שלנו
                </h2>
                <p>
                  העבודה במשק מתבצעת מתוך מחויבות לאיכות, לטריות ולשירות אישי.
                  במשק 22 אין פערי תיווך — אתם מקבלים תוצרת ישירות מהחקלאי,
                  כפי שצריך להיות.
                </p>
              </div>

              <div className="flex items-center gap-2 text-sm text-stone-500">
                <MapPin className="h-4 w-4 text-brand-500 shrink-0" aria-hidden="true" />
                <span>מושב ינון — סביבה חקלאית תומכת לצמיחה ולעשייה</span>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { value: "יומי", label: "קטיף טרי" },
                { value: "100%", label: "ישירות מהחקלאי" },
                { value: "א׳–ה׳", label: "9:00–18:00" },
                { value: "ו׳", label: "7:30–15:00" },
              ].map(({ value, label }) => (
                <div
                  key={label}
                  className="bg-brand-50 rounded-2xl border border-brand-100 p-5 text-center"
                >
                  <p className="text-3xl font-bold text-brand-700 mb-1">
                    {value}
                  </p>
                  <p className="text-sm text-stone-500">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </div>

      {/* Values */}
      <div
        className="py-14 lg:py-20"
        style={{ backgroundColor: "var(--color-surface)" }}
      >
        <Container>
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              מה מייחד את משק 22
            </h2>
            <p className="text-stone-500 max-w-xl mx-auto">
              חקלאות שבאה מהלב — עם מחויבות אמיתית לאיכות ולשירות.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {VALUES.map(({ icon: Icon, title, desc, color }) => (
              <div
                key={title}
                className="bg-white rounded-2xl border border-stone-100 p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
              >
                <div
                  className={`h-10 w-10 rounded-xl flex items-center justify-center mb-4`}
                  style={{
                    backgroundColor: color.includes("emerald")
                      ? "#d1fae5"
                      : color.includes("amber")
                        ? "#fef3c7"
                        : color.includes("rose")
                          ? "#ffe4e6"
                          : "#e0f2fe",
                  }}
                >
                  <Icon
                    className={`h-5 w-5 ${color.split(" ")[1]}`}
                    aria-hidden="true"
                  />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-base text-stone-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </div>

      {/* Commitment */}
      <div className="py-14 lg:py-20 bg-white">
        <Container>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-3">
                המחויבות שלנו לאיכות ולשירות
              </h2>
              <p className="text-stone-500 leading-relaxed mb-6">
                אנחנו לא מסתירים מאחורי תנאי שירות. זו ההתחייבות שלנו בכתב —
                ובמילה.
              </p>
              <ul className="space-y-3">
                {COMMITMENTS.map((c) => (
                  <li
                    key={c}
                    className="flex items-start gap-3 text-base text-stone-700"
                  >
                    <CheckCircle2
                      className="h-5 w-5 text-brand-500 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    {c}
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA card */}
            <div className="bg-brand-600 rounded-2xl p-8 text-white">
              <Leaf
                className="h-10 w-10 text-brand-200 mb-5"
                aria-hidden="true"
              />
              <h3 className="text-2xl font-bold mb-3">מוכנים לנסות?</h3>
              <p className="text-brand-100 mb-6 leading-relaxed">
                הצטרפו ללקוחות הפרטיים והמוסדיים שכבר נהנים מתוצרת טרייה
                ואיכותית — ישירות מהשדה לביתם או לעסקם.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full bg-white text-brand-700 font-semibold text-sm hover:bg-brand-50 transition-colors"
                >
                  לדף הבית
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a
                  href="tel:*3722"
                  className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full border border-white/30 text-white font-semibold text-sm hover:bg-white/10 transition-colors"
                >
                  <Phone className="h-4 w-4" />
                  *3722
                </a>
              </div>
            </div>
          </div>
        </Container>
      </div>

      {/* Contact strip */}
      <div
        className="py-10 border-t border-stone-100"
        style={{ backgroundColor: "var(--color-surface)" }}
      >
        <Container>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-stone-500">
            <span className="font-medium text-gray-900">יש לכם שאלה?</span>
            <a
              href="tel:*3722"
              className="flex items-center gap-1.5 hover:text-brand-700 transition-colors"
            >
              <Phone className="h-4 w-4 text-brand-500" />
              *3722 (א׳–ה׳ 9:00–18:00, ו׳ 7:30–15:00)
            </a>
            <a
              href="mailto:hello@meshek22.co.il"
              className="flex items-center gap-1.5 hover:text-brand-700 transition-colors"
            >
              <Mail className="h-4 w-4 text-brand-500" />
              hello@meshek22.co.il
            </a>
          </div>
        </Container>
      </div>
    </main>
  );
}
