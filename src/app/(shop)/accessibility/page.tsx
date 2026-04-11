import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "הצהרת נגישות | משק 22",
  description: "הצהרת הנגישות של אתר משק 22 — מחויבותנו להנגשת השירות לכלל המשתמשים.",
};

export default function AccessibilityPage() {
  return (
    <main className="flex-1" style={{ backgroundColor: "var(--color-surface)" }}>
      <div className="bg-white border-b border-stone-100 py-10">
        <Container>
          <h1 className="text-3xl font-bold text-gray-900">הצהרת נגישות</h1>
          <p className="text-stone-500 mt-2 text-sm">עדכון אחרון: אפריל 2026</p>
        </Container>
      </div>

      <Container className="py-10 lg:py-14">
        <div className="max-w-3xl mx-auto">

          <Section title="מבוא — מחויבותנו לנגישות">
            <p>
              משק 22 מאמין שלכל אדם מגיעה גישה שווה לשירותים דיגיטליים, ללא תלות ביכולות פיזיות,
              קוגניטיביות או טכנולוגיות. אנו פועלים לשפר את נגישות האתר באופן שוטף, ושואפים
              לעמוד ברוח הנחיות הנגישות הבינלאומיות WCAG 2.1 ברמה AA.
            </p>
            <p>
              יש לציין כי אתר זה נמצא בשלבי פיתוח מתמשכים. אנו עושים מאמצים להנגיש את
              התכנים והפעולות המרכזיות, אך ייתכן שעדיין קיימים אזורים שטרם הונגשו במלואם.
            </p>
          </Section>

          <Section title="התאמות נגישות שבוצעו באתר">
            <p>בין ההתאמות שבוצעו או שאנו מיישמים באתר:</p>
            <ul>
              <li>
                <strong>מבנה ניווט ברור:</strong> האתר בנוי עם כותרות היררכיות (H1, H2 וכו׳)
                כדי לאפשר ניווט מסודר לגולשים המשתמשים בקורא מסך.
              </li>
              <li>
                <strong>תמיכה בכיווניות RTL:</strong> האתר בנוי מלכתחילה בכיוון עברית
                (ימין לשמאל) ומותאם מלא לעברית.
              </li>
              <li>
                <strong>התאמה למסכים שונים:</strong> האתר רספונסיבי ומתאים לשימוש
                במחשב, טאבלט ומכשיר נייד.
              </li>
              <li>
                <strong>ניגודיות צבעים:</strong> אנו שואפים לשמור על ניגודיות קריאה
                בין טקסט לרקע, בהתאם להנחיות הנגישות.
              </li>
              <li>
                <strong>תוויות נגישות לכפתורים:</strong> כפתורים ואלמנטים אינטראקטיביים
                מלווים בתוויות aria-label להקשר ברור לטכנולוגיות מסייעות.
              </li>
              <li>
                <strong>טקסט חלופי לתמונות:</strong> תמונות מוצרים מלוות בטקסט
                חלופי (alt text) המתאר את תוכנן.
              </li>
              <li>
                <strong>ניווט עם מקלדת:</strong> הפעולות המרכזיות באתר נגישות באמצעות
                מקלדת בלבד, ללא צורך בעכבר.
              </li>
              <li>
                <strong>גופן קריא:</strong> האתר משתמש בגופנים עבריים מותאמים (Rubik ו-Assistant)
                הנחשבים לקריאים ובהירים.
              </li>
            </ul>
          </Section>

          <Section title="מגבלות נגישות ידועות">
            <p>
              למרות מאמצינו, ייתכן שיתגלו ליקויי נגישות באזורים מסוימים. בין הדברים שאנו
              עדיין עובדים לשפר:
            </p>
            <ul>
              <li>חלק מהתמונות עשויות לא לכלול תיאור מלא ומספק.</li>
              <li>חלק מהפעולות האינטראקטיביות עשויות להיות מאתגרות עבור קוראי מסך ישנים.</li>
              <li>לא בוצע עדיין ביקורת נגישות מקיפה ומלאה על ידי גוף חיצוני.</li>
            </ul>
            <p>
              אנו מתחייבים לטפל בליקויים שיובאו לידיעתנו בהקדם האפשרי.
            </p>
          </Section>

          <Section title="פניות בנושא נגישות">
            <p>
              נתקלתם בתוכן שאינו נגיש, או שתרצו לדווח על בעיית נגישות? אנו מזמינים אתכם
              לפנות אלינו. כל פנייה תיבחן ברצינות ונשאף לטפל בה בהקדם.
            </p>
            <p>
              ניתן לפנות בכל אחת מהדרכים הבאות:
            </p>
            <ul>
              <li>
                <strong>טלפון:</strong>{" "}
                <a href="tel:0508863030" className="text-brand-700 hover:underline">
                  050-8863030
                </a>{" "}
                (ימים א׳–ו׳, 07:00–18:00)
              </li>
              <li>
                <strong>דוא&quot;ל:</strong>{" "}
                <a href="mailto:ysmeshek22@gmail.com" className="text-brand-700 hover:underline">
                  ysmeshek22@gmail.com
                </a>
              </li>
            </ul>
            <p>
              בפנייתכם אנא ציינו: את הדף שבו נתקלתם בבעיה, תיאור הבעיה, והדפדפן או
              המכשיר בו אתם משתמשים. זה יסייע לנו לאתר ולתקן את הבעיה מהר יותר.
            </p>
          </Section>

          <Section title="יצירת קשר">
            <ul>
              <li>
                <strong>שם העסק:</strong> משק 22, מושב ינון
              </li>
              <li>
                <strong>טלפון:</strong>{" "}
                <a href="tel:0508863030" className="text-brand-700 hover:underline">
                  050-8863030
                </a>
              </li>
              <li>
                <strong>דוא&quot;ל:</strong>{" "}
                <a href="mailto:ysmeshek22@gmail.com" className="text-brand-700 hover:underline">
                  ysmeshek22@gmail.com
                </a>
              </li>
            </ul>
          </Section>

        </div>
      </Container>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold text-gray-900 mb-3 pb-2 border-b border-stone-100">
        {title}
      </h2>
      <div className="space-y-3 text-[15px] text-stone-600 leading-relaxed [&_ul]:list-disc [&_ul]:ps-5 [&_ul]:space-y-1.5 [&_a]:text-brand-700 [&_a:hover]:underline">
        {children}
      </div>
    </section>
  );
}
