import { Leaf, Phone, Mail, MapPin } from "lucide-react";
import { Container } from "@/components/ui/Container";

const FOOTER_LINKS = {
  shop: [
    { label: "ירקות", href: "/vegetables" },
    { label: "פירות", href: "/fruits" },
    { label: "ירקות שורש", href: "/vegetables?sub=root-vegetables" },
    { label: "עשבי תיבול", href: "/vegetables?sub=herbs" },
    { label: "פירות הדר", href: "/fruits?sub=citrus-fruits" },
    { label: "פירות אורגניים", href: "/fruits?sub=organic-fruits" },
  ],
  info: [
    { label: "אודות משק 22", href: "/about" },
    { label: "אזורי משלוח", href: "/delivery-areas" },
    { label: "שאלות נפוצות", href: "/faq" },
    { label: "מדיניות החזרות", href: "/returns" },
    { label: "תנאי שימוש", href: "/terms" },
    { label: "מדיניות פרטיות", href: "/privacy" },
  ],
  account: [
    { label: "כניסה לחשבון", href: "/login" },
    { label: "הרשמה", href: "/register" },
    { label: "ההזמנות שלי", href: "/account/orders" },
    { label: "הפרופיל שלי", href: "/account" },
  ],
};

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-stone-900 text-stone-300 mt-auto">
      {/* Main footer */}
      <div className="border-b border-stone-800">
        <Container className="py-14">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">
            {/* Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-9 w-9 bg-brand-600 rounded-xl flex items-center justify-center">
                  <Leaf className="h-5 w-5 text-white" aria-hidden="true" />
                </div>
                <span className="font-bold text-xl text-white">משק 22</span>
              </div>
              <p className="text-sm leading-relaxed text-stone-400 mb-6 max-w-xs">
                ירקות ופירות טריים מהמשק ישירות לביתכם. איכות ללא פשרות, כל יום
                מחדש.
              </p>

              {/* Contact */}
              <div className="flex flex-col gap-2 text-sm">
                <a
                  href="tel:*3722"
                  className="flex items-center gap-2 hover:text-brand-400 transition-colors"
                >
                  <Phone className="h-4 w-4 text-brand-500 shrink-0" />
                  *3722 (א׳–ו׳, 07:00–18:00)
                </a>
                <a
                  href="mailto:hello@meshek22.co.il"
                  className="flex items-center gap-2 hover:text-brand-400 transition-colors"
                >
                  <Mail className="h-4 w-4 text-brand-500 shrink-0" />
                  hello@meshek22.co.il
                </a>
                <span className="flex items-center gap-2 text-stone-500">
                  <MapPin className="h-4 w-4 text-brand-500 shrink-0" />
                  משלוחים לכל הארץ
                </span>
              </div>

              {/* Social */}
              <div className="flex items-center gap-3 mt-5">
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="עמוד האינסטגרם שלנו"
                  className="h-9 w-9 flex items-center justify-center rounded-full bg-stone-800 hover:bg-brand-600 transition-colors"
                >
                  {/* Instagram SVG */}
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                  </svg>
                </a>
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="עמוד הפייסבוק שלנו"
                  className="h-9 w-9 flex items-center justify-center rounded-full bg-stone-800 hover:bg-brand-600 transition-colors"
                >
                  {/* Facebook SVG */}
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                  </svg>
                </a>
                <a
                  href="https://wa.me/972500000000"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="וואטסאפ שלנו"
                  className="h-9 w-9 flex items-center justify-center rounded-full bg-stone-800 hover:bg-brand-600 transition-colors"
                >
                  {/* WhatsApp SVG */}
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Shop links */}
            <div>
              <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">
                החנות
              </h3>
              <ul className="flex flex-col gap-2">
                {FOOTER_LINKS.shop.map((l) => (
                  <li key={l.href}>
                    <a
                      href={l.href}
                      className="text-sm text-stone-400 hover:text-brand-400 transition-colors"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Info links */}
            <div>
              <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">
                מידע
              </h3>
              <ul className="flex flex-col gap-2">
                {FOOTER_LINKS.info.map((l) => (
                  <li key={l.href}>
                    <a
                      href={l.href}
                      className="text-sm text-stone-400 hover:text-brand-400 transition-colors"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Account links */}
            <div>
              <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">
                החשבון שלי
              </h3>
              <ul className="flex flex-col gap-2">
                {FOOTER_LINKS.account.map((l) => (
                  <li key={l.href}>
                    <a
                      href={l.href}
                      className="text-sm text-stone-400 hover:text-brand-400 transition-colors"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </div>

      {/* Bottom bar */}
      <Container className="py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-stone-500">
          <p>© {year} משק 22. כל הזכויות שמורות.</p>
          <p>עוצב ופותח בישראל 🇮🇱</p>
        </div>
      </Container>
    </footer>
  );
}
