import { Truck, Sprout, Award, HeadphonesIcon } from "lucide-react";
import { Container } from "@/components/ui/Container";

const TRUST_ITEMS = [
  {
    icon: Sprout,
    title: "נקטף הבוקר",
    subtitle: "מגיע אליכם ביום הקטיף",
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
    icon: Award,
    title: "איכות מובטחת",
    subtitle: "100% החזר כספי אם אינכם מרוצים",
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
      className="bg-white py-7 border-y border-stone-100"
      style={{ borderTopColor: "var(--color-brand-100)" }}
      aria-label="למה לקנות אצלנו"
    >
      <Container>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-stone-100 rounded-2xl overflow-hidden">
          {TRUST_ITEMS.map(({ icon: Icon, title, subtitle, color, bg }, i) => (
            <div
              key={title}
              className="flex items-center gap-4 p-5 lg:p-6 bg-white hover:bg-stone-50 transition-colors"
            >
              <div
                className={`shrink-0 h-12 w-12 rounded-xl ${bg} flex items-center justify-center`}
              >
                <Icon className={`h-6 w-6 ${color}`} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm text-gray-900 leading-tight">{title}</p>
                <p className="text-xs text-stone-400 mt-0.5 leading-snug">{subtitle}</p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
