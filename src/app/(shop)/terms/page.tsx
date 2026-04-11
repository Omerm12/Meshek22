import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "תקנון ותנאי שימוש | משק 22",
  description: "תקנון ותנאי שימוש של חנות משק 22 — הזמנות, משלוחים, תשלומים וביטולים.",
};

export default function TermsPage() {
  return (
    <main className="flex-1" style={{ backgroundColor: "var(--color-surface)" }}>
      <div className="bg-white border-b border-stone-100 py-10">
        <Container>
          <h1 className="text-3xl font-bold text-gray-900">תקנון ותנאי שימוש</h1>
          <p className="text-stone-500 mt-2 text-sm">עדכון אחרון: אפריל 2026</p>
        </Container>
      </div>

      <Container className="py-10 lg:py-14">
        <div className="max-w-3xl mx-auto prose-custom">
          <Section title="1. פרטי העסק">
            <p>
              <strong>שם העסק:</strong> משק 22<br />
              <strong>כתובת:</strong> משק 22, מושב ינון<br />
              <strong>טלפון:</strong>{" "}
              <a href="tel:0508863030" className="text-brand-700 hover:underline">050-8863030</a><br />
              <strong>דוא&quot;ל:</strong>{" "}
              <a href="mailto:ysmeshek22@gmail.com" className="text-brand-700 hover:underline">ysmeshek22@gmail.com</a>
            </p>
          </Section>

          <Section title="2. כללי">
            <p>
              ברוכים הבאים לאתר משק 22. השימוש באתר ובשירותים המוצעים בו מהווה הסכמה לתנאי
              השימוש המפורטים להלן. אנא קראו את התקנון בעיון לפני ביצוע הזמנה.
            </p>
            <p>
              האתר מיועד לרכישת ירקות, פירות ומוצרי טבע טריים ישירות ממשק 22 לביתכם.
            </p>
          </Section>

          <Section title="3. ביצוע הזמנה">
            <ul>
              <li>הזמנות מבוצעות דרך האתר בלבד, לאחר יצירת חשבון משתמש.</li>
              <li>על הלקוח למלא פרטים מדויקים: שם מלא, כתובת למשלוח, מספר טלפון ודוא&quot;ל.</li>
              <li>לאחר הגשת ההזמנה יישלח אישור בדוא&quot;ל ו/או SMS.</li>
              <li>הזמנה תיחשב מאושרת רק לאחר שנציג מטעם משק 22 יאשר את ביצועה — בין אם בטלפון, בהודעת SMS, או בדוא&quot;ל.</li>
              <li>במקרה שמוצר שהוזמן אינו זמין, ניצור קשר לתיאום חלופה או להחזר.</li>
            </ul>
          </Section>

          <Section title="4. תשלום">
            <p>
              <strong>חשוב:</strong> האתר אינו מאפשר תשלום מקוון בשלב זה.
            </p>
            <p>
              התשלום מתבצע לאחר קבלת ההזמנה, בתיאום ישיר עם נציג משק 22 —
              בטלפון <a href="tel:0508863030" className="text-brand-700 hover:underline">050-8863030</a> או
              בדוא&quot;ל <a href="mailto:ysmeshek22@gmail.com" className="text-brand-700 hover:underline">ysmeshek22@gmail.com</a>.
            </p>
            <p>אמצעי התשלום הזמינים יימסרו בעת תיאום ההזמנה.</p>
          </Section>

          <Section title="5. משלוחים">
            <ul>
              <li>המשלוחים מתבצעים לאזורים המפורטים ב<a href="/delivery-areas" className="text-brand-700 hover:underline">דף אזורי המשלוח</a>.</li>
              <li>ניתן לבדוק זמינות משלוח לישובכם לפני ביצוע ההזמנה.</li>
              <li>משלוחים מתבצעים ימים א׳–ה׳. אין משלוחים בשישי, שבת ובחגים.</li>
              <li>הזמנות שהוגשו עד השעה 22:00 יצאו ביום העסקים הבא. הזמנות לאחר 22:00 יצאו יום לאחר מכן.</li>
              <li>תקבלו SMS בבוקר יום המשלוח עם חלון זמנים משוער.</li>
              <li>דמי המשלוח ומינימום ההזמנה משתנים בהתאם לאזור — ראו דף אזורי המשלוח.</li>
            </ul>
          </Section>

          <Section title="6. ביטולים והחזרות">
            <ul>
              <li>ניתן לבטל הזמנה עד 6 שעות לפני יציאת המשלוח — צרו קשר בטלפון או בדוא&quot;ל.</li>
              <li>לאחר יציאת המשלוח לא ניתן לבטל הזמנה.</li>
              <li>
                מוצר שהגיע פגום, נובל מוקדם מהרגיל, או שאינו לשביעות רצונכם — החלפה
                מיידית ללא עלות תוך 24 שעות מקבלת המשלוח. יש ליצור קשר ולצרף תמונה.
              </li>
              <li>
                בשל אופי המוצרים (ירקות ופירות טריים), לא ניתן להחזיר מוצרים שנפתחו,
                שנוצלו חלקית, או שחלף מועד מסירתם.
              </li>
            </ul>
          </Section>

          <Section title="7. אחריות">
            <p>
              משק 22 אינו אחראי לעיכובים הנובעים מגורמים שאינם בשליטתו (מזג אוויר, אסונות
              טבע, שביתות וכד׳). במקרים אלו נפעל ליצור קשר ולתאם מועד חלופי.
            </p>
            <p>
              האתר מסופק &quot;כפי שהוא&quot; (AS IS). אנו עושים מאמץ להציג מידע מדויק אך
              איננו מתחייבים לזמינות מוצרים ספציפיים בכל עת.
            </p>
          </Section>

          <Section title="8. יצירת קשר">
            <p>לכל שאלה, בקשה או תלונה ניתן לפנות אלינו:</p>
            <ul>
              <li>
                <strong>טלפון:</strong>{" "}
                <a href="tel:0508863030" className="text-brand-700 hover:underline">050-8863030</a>{" "}
                (ימים א׳–ו׳, 07:00–18:00)
              </li>
              <li>
                <strong>דוא&quot;ל:</strong>{" "}
                <a href="mailto:ysmeshek22@gmail.com" className="text-brand-700 hover:underline">ysmeshek22@gmail.com</a>
              </li>
              <li>
                <strong>כתובת:</strong> משק 22, מושב ינון
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
