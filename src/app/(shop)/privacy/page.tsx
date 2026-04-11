import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "מדיניות פרטיות | משק 22",
  description: "מדיניות הפרטיות של משק 22 — איזה מידע נאסף, כיצד הוא נשמר ומשמש.",
};

export default function PrivacyPage() {
  return (
    <main className="flex-1" style={{ backgroundColor: "var(--color-surface)" }}>
      <div className="bg-white border-b border-stone-100 py-10">
        <Container>
          <h1 className="text-3xl font-bold text-gray-900">מדיניות פרטיות</h1>
          <p className="text-stone-500 mt-2 text-sm">עדכון אחרון: אפריל 2026</p>
        </Container>
      </div>

      <Container className="py-10 lg:py-14">
        <div className="max-w-3xl mx-auto">
          <Section title="1. כללי">
            <p>
              משק 22 מכבד את פרטיות המשתמשים באתר ומחויב לשמירה על המידע האישי שנמסר לנו.
              מדיניות זו מפרטת איזה מידע אנו אוספים, כיצד הוא נשמר ומשמש.
            </p>
            <p>
              שימוש באתר מהווה הסכמה לאיסוף ועיבוד המידע כמתואר כאן.
            </p>
          </Section>

          <Section title="2. מידע הנאסף">
            <p>בעת שימוש באתר ו/או ביצוע הזמנה, ייתכן ונאסוף את הפרטים הבאים:</p>
            <ul>
              <li><strong>פרטי זיהוי:</strong> שם מלא, כתובת דוא&quot;ל, מספר טלפון.</li>
              <li><strong>כתובת משלוח:</strong> רחוב, ישוב, מיקוד.</li>
              <li><strong>נתוני התחברות:</strong> כתובת דוא&quot;ל בלבד; הסיסמה אינה נשמרת — ההתחברות מתבצעת באמצעות קוד חד-פעמי (OTP) שנשלח לדוא&quot;ל.</li>
              <li><strong>היסטוריית הזמנות:</strong> פרטי ההזמנות שבוצעו, כולל מוצרים, כמויות ומועדים.</li>
              <li><strong>נתוני גלישה:</strong> כתובת IP, סוג דפדפן, ומידע טכני בסיסי לצורך תפעול האתר.</li>
            </ul>
          </Section>

          <Section title="3. מטרת איסוף המידע">
            <p>המידע נאסף אך ורק למטרות הבאות:</p>
            <ul>
              <li>עיבוד וניהול הזמנות ומשלוחים.</li>
              <li>יצירת קשר בנוגע להזמנה (אישור, עדכוני משלוח, שינויים).</li>
              <li>שירות לקוחות ומתן מענה לפניות.</li>
              <li>שיפור חוויית השימוש באתר.</li>
              <li>עמידה בדרישות חוקיות ורגולטוריות.</li>
            </ul>
            <p>איננו משתמשים במידע לצרכי פרסום צד שלישי או מכירת מידע.</p>
          </Section>

          <Section title="4. שיתוף מידע עם גורמים חיצוניים">
            <p>
              אנו לא מוכרים, מעבירים או משתפים פרטים אישיים עם גורמים שלישיים, פרט
              לשירותים הדרושים לתפעול האתר:
            </p>
            <ul>
              <li>
                <strong>Supabase (supabase.com):</strong> שירות בסיס נתונים ואימות משתמשים.
                המידע מאוחסן בשרתי Supabase באירופה. עיבוד נתוני OTP ואימות מתבצע דרך
                שירות זה.
              </li>
              <li>
                <strong>ספקי SMS:</strong> מספר הטלפון משמש לשליחת עדכוני משלוח ב-SMS.
                מספרי הטלפון אינם נמסרים לצדדים שלישיים אחרים.
              </li>
            </ul>
            <p>
              כל הגורמים החיצוניים מחויבים לסטנדרטים מקובלים של אבטחת מידע.
            </p>
          </Section>

          <Section title="5. שמירה ואבטחת המידע">
            <p>
              המידע מאוחסן בשרתים מאובטחים של Supabase עם הצפנה בהעברה (TLS/HTTPS)
              ובאחסון. הגישה לנתונים מוגבלת לצוות המאושר בלבד.
            </p>
            <p>
              סיסמאות אינן נשמרות — שיטת ההתחברות מבוססת על קוד OTP חד-פעמי בלבד,
              מה שמפחית את הסיכון לדליפת סיסמאות.
            </p>
            <p>
              אנו שומרים מידע כל עוד הוא נדרש לתפעול השירות. ניתן לבקש מחיקת מידע
              אישי בכל עת.
            </p>
          </Section>

          <Section title="6. זכויות המשתמש">
            <p>על פי חוק הגנת הפרטיות הישראלי, יש לכם זכות:</p>
            <ul>
              <li>לבקש לעיין במידע השמור עליכם.</li>
              <li>לבקש תיקון מידע שגוי.</li>
              <li>לבקש מחיקת המידע האישי שלכם.</li>
            </ul>
            <p>
              לממש זכויות אלה, פנו אלינו בדוא&quot;ל:{" "}
              <a href="mailto:ysmeshek22@gmail.com" className="text-brand-700 hover:underline">
                ysmeshek22@gmail.com
              </a>
            </p>
          </Section>

          <Section title="7. עוגיות (Cookies)">
            <p>
              האתר עשוי להשתמש בעוגיות הכרחיות לצורך תפעול תקין (שמירת מצב
              ההתחברות, סל הקניות וכד׳). אין שימוש בעוגיות פרסום או מעקב.
            </p>
          </Section>

          <Section title="8. יצירת קשר">
            <p>לכל שאלה בנוגע לפרטיות ניתן לפנות אלינו:</p>
            <ul>
              <li>
                <strong>דוא&quot;ל:</strong>{" "}
                <a href="mailto:ysmeshek22@gmail.com" className="text-brand-700 hover:underline">
                  ysmeshek22@gmail.com
                </a>
              </li>
              <li>
                <strong>טלפון:</strong>{" "}
                <a href="tel:0508863030" className="text-brand-700 hover:underline">
                  050-8863030
                </a>
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
