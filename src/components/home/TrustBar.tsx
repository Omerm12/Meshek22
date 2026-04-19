import { Truck, Leaf, HeadphonesIcon, ShieldCheck } from "lucide-react";
import { Container } from "@/components/ui/Container";

const TRUST_ITEMS = [
  {
    icon: Leaf,
    title: "הכי טרי שיש",
    subtitle: "מהמשק שלנו ישר לביתכם",
    color: "text-brand-600",
    bg: "bg-brand-50",
  },
  {
    icon: Truck,
    title: "משלוח מהיר",
    subtitle: "עד 24 שעות לדלת שלכם",
    color: "text-sky-600",
    bg: "bg-sky-50",
  },
  {
    icon: ShieldCheck,
    title: "כשר",
    subtitle: "תחת השגחה קפדנית",
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  {
    icon: HeadphonesIcon,
    title: "שירות אישי",
    subtitle: "צוות שעונה בטלפון ובווטסאפ",
    color: "text-purple-600",
    bg: "bg-purple-50",
  },
];

export function TrustBar() {
  return (
    <section
      className="bg-white py-10 sm:py-12 border-y border-stone-100"
      style={{ borderTopColor: "var(--color-brand-100)" }}
      aria-label="למה לקנות אצלנו"
    >
      <Container>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-stone-100 rounded-2xl overflow-hidden">
          {TRUST_ITEMS.map(({ icon: Icon, title, subtitle, color, bg }) => (
            <div
              key={title}
              className="flex flex-col items-center text-center gap-4 p-6 sm:p-7 lg:p-8 bg-white hover:bg-stone-50 transition-colors"
            >
              <div
                className={`shrink-0 h-16 w-16 rounded-2xl ${bg} flex items-center justify-center`}
              >
                <Icon className={`h-9 w-9 ${color}`} aria-hidden="true" />
              </div>
              <div>
                <p className="font-bold text-base sm:text-lg text-gray-900 leading-tight">{title}</p>
                <p className="text-sm text-stone-400 mt-1 leading-snug">{subtitle}</p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
