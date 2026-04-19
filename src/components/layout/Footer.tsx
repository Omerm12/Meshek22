import { Leaf, Phone, Mail, MapPin } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { FooterAccountLinks } from "@/components/layout/FooterAccountLinks";

const FOOTER_LINKS = {
  shop: [
    { label: "כל המוצרים",    href: "/products" },
    { label: "ירקות",         href: "/vegetables" },
    { label: "פירות",         href: "/fruits" },
    { label: "ירקות שורש",    href: "/vegetables?sub=root-vegetables" },
    { label: "עשבי תיבול",    href: "/vegetables?sub=herbs" },
    { label: "פירות הדר",     href: "/fruits?sub=citrus-fruits" },
  ],
  info: [
    { label: "אודות משק 22",    href: "/about" },
    { label: "אזורי משלוח",     href: "/delivery-areas" },
    { label: "תנאי שימוש",      href: "/terms" },
    { label: "מדיניות פרטיות",  href: "/privacy" },
    { label: "הצהרת נגישות",   href: "/accessibility" },
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
                ירקות ופירות טריים מהמשק ישירות לביתכם.<br />
                איכות ללא פשרות, כל יום מחדש.
              </p>

              {/* Contact */}
              <div className="flex flex-col gap-2 text-sm">
                <a
                  href="tel:0508863030"
                  className="flex items-center gap-2 hover:text-brand-400 transition-colors"
                >
                  <Phone className="h-4 w-4 text-brand-500 shrink-0" />
                  050-8863030
                </a>
                <a
                  href="mailto:ysmeshek22@gmail.com"
                  className="flex items-center gap-2 hover:text-brand-400 transition-colors"
                >
                  <Mail className="h-4 w-4 text-brand-500 shrink-0" />
                  ysmeshek22@gmail.com
                </a>
                <span className="flex items-center gap-2 text-stone-500">
                  <MapPin className="h-4 w-4 text-brand-500 shrink-0" />
                  מושב ינון
                </span>
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

            {/* Account links — auth-aware: opens login modal when logged out */}
            <div>
              <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">
                החשבון שלי
              </h3>
              <FooterAccountLinks />
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
