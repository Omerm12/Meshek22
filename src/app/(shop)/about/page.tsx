import type { Metadata } from "next";
import Link from "next/link";
import {
  Leaf,
  Heart,
  Clock,
  Star,
  Truck,
  Phone,
  Mail,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "אודות משק 22",
  description:
    "הסיפור מאחורי משק 22 – ירקות ופירות טריים מהשדה ישירות לביתכם. מי אנחנו, מה מייחד אותנו, והתחייבות שלנו לאיכות.",
};

const VALUES = [
  {
    icon: Leaf,
    title: "ירקות שגדלו בשדה, לא במחסן",
    desc: "אנחנו עובדים ישירות עם חקלאים מקומיים. כל מה שמגיע אליכם נלקט לכל היותר 48 שעות קודם – לא שבועות.",
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    icon: Clock,
    title: "משלוח מהיר עד הדלת",
    desc: "הזמינו עד הערב, קבלו מחר. לרוב אזורי גוש דן – עד 24 שעות. לשאר הארץ – 1 עד 3 ימי עסקים.",
    color: "bg-sky-50 text-sky-600",
  },
  {
    icon: Heart,
    title: "שירות אמיתי, לא בוט",
    desc: "יש שאלה? מישהו עונה. ביטול הזמנה, שינוי כמות, בקשה מיוחדת – אפשר תמיד. אנחנו עסק משפחתי, לא תאגיד.",
    color: "bg-rose-50 text-rose-600",
  },
  {
    icon: Star,
    title: "איכות ללא פשרות",
    desc: "כל אצווה עוברת מיון ידני. מה שלא היינו מכניסים לבית שלנו – לא יגיע לבית שלכם.",
    color: "bg-amber-50 text-amber-600",
  },
];

const COMMITMENTS = [
  "אם מוצר הגיע פגום – החלפה מיידית ללא שאלות",
  "מחירים שקופים ויציבים, ללא הפתעות בקופה",
  "אריזה מינימלית – אנחנו דואגים לסביבה",
  "תמיד ניתן לעדכן הזמנה עד 24 שעות לפני המשלוח",
];

export default function AboutPage() {
  return (
    <main className="flex-1">

      {/* Hero */}
      <div className="bg-gradient-to-b from-brand-700 to-brand-600 text-white py-16 lg:py-24">
        <Container>
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 bg-white/15 border border-white/20 rounded-full px-3 py-1.5 mb-4 text-sm font-semibold text-brand-100">
              <Leaf className="h-3.5 w-3.5" aria-hidden="true" />
              הסיפור שלנו
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold mb-5 leading-tight">
              ירקות ופירות כמו שצריך להיות
            </h1>
            <p className="text-brand-100 text-lg leading-relaxed">
              משק 22 הוקם מתוך תסכול פשוט: למה קשה כל כך לקנות ירקות טריים
              מבלי לנסוע לשוק, להמר על מה שיהיה בסופר, או לקבל אריזה
              מוזנחת מהמשלוח?
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
                <h2 className="text-2xl font-bold text-gray-900 mb-3">מי אנחנו</h2>
                <p>
                  אנחנו משפחת לוי מגדרה. גדלנו על חקלאות, ידענו תמיד מה זה
                  ירק טרי אמיתי. לפני כמה שנים החלטנו להפסיק לקנות ירקות בסופר
                  ולחזור לבסיס – לקנות ישירות מהשדה.
                </p>
                <p className="mt-3">
                  ב-2022 הבנו שאנחנו לא לבד. שכנים ביקשו להצטרף. חברים ביקשו.
                  ואז החלטנו לפתוח את זה לכולם – ובאו{" "}
                  <strong className="text-gray-900">משק 22</strong>.
                </p>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                  למה בחרנו לעשות את זה
                </h2>
                <p>
                  כי האוכל שאנחנו אוכלים חשוב. כי החקלאי שמגדל את הגזר שלכם
                  ראוי שתדעו את שמו. וכי הנסיעה לשוק לא תמיד מתאפשרת –
                  ולמה שתצטרכו לוותר על טריות בגלל זה?
                </p>
                <p className="mt-3">
                  המטרה שלנו פשוטה: לחבר בין האדמה לבין השולחן שלכם,
                  בצורה ישירה, הגונה וטעימה.
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { value: "3,000+", label: "לקוחות מרוצים" },
                { value: "48h", label: "מהשדה לדלת" },
                { value: "80+", label: "יישובים בארץ" },
                { value: "100%", label: "ירקות טריים" },
              ].map(({ value, label }) => (
                <div
                  key={label}
                  className="bg-brand-50 rounded-2xl border border-brand-100 p-5 text-center"
                >
                  <p className="text-3xl font-bold text-brand-700 mb-1">{value}</p>
                  <p className="text-sm text-stone-500">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </div>

      {/* Values */}
      <div className="py-14 lg:py-20" style={{ backgroundColor: "var(--color-surface)" }}>
        <Container>
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">מה מייחד את משק 22</h2>
            <p className="text-stone-500 max-w-xl mx-auto">
              לא הכל שווה. זו הסיבה שבחרנו לבנות עסק אחרת.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {VALUES.map(({ icon: Icon, title, desc, color }) => (
              <div
                key={title}
                className="bg-white rounded-2xl border border-stone-100 p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
              >
                <div className={`h-10 w-10 rounded-xl ${color} bg-opacity-20 flex items-center justify-center mb-4`}
                     style={{ backgroundColor: color.includes("emerald") ? "#d1fae5" : color.includes("sky") ? "#e0f2fe" : color.includes("rose") ? "#ffe4e6" : "#fef3c7" }}>
                  <Icon className={`h-5 w-5 ${color.split(" ")[1]}`} aria-hidden="true" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-stone-500 leading-relaxed">{desc}</p>
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
                התחייבות שלנו לטריות ואיכות
              </h2>
              <p className="text-stone-500 leading-relaxed mb-6">
                אנחנו לא מסתירים מאחורי תנאי שירות. זו ההתחייבות שלנו בכתב –
                ובמילה.
              </p>
              <ul className="space-y-3">
                {COMMITMENTS.map((c) => (
                  <li key={c} className="flex items-start gap-3 text-sm text-stone-700">
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
              <Leaf className="h-10 w-10 text-brand-200 mb-5" aria-hidden="true" />
              <h3 className="text-2xl font-bold mb-3">מוכנים לנסות?</h3>
              <p className="text-brand-100 mb-6 leading-relaxed">
                הצטרפו לאלפי לקוחות שכבר גילו שירקות טריים יכולים להגיע
                לביתם – בלי סופר, בלי תורים, בלי ויתורים.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/category/yerakot"
                  className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full bg-white text-brand-700 font-semibold text-sm hover:bg-brand-50 transition-colors"
                >
                  לחנות
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
      <div className="py-10 border-t border-stone-100" style={{ backgroundColor: "var(--color-surface)" }}>
        <Container>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-stone-500">
            <span className="font-medium text-gray-900">יש לכם שאלה?</span>
            <a
              href="tel:*3722"
              className="flex items-center gap-1.5 hover:text-brand-700 transition-colors"
            >
              <Phone className="h-4 w-4 text-brand-500" />
              *3722 (א׳–ו׳, 07:00–18:00)
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
