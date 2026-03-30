import { MapPin, Clock, Truck, CheckCircle2 } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { formatPrice } from "@/lib/utils/money";
import { MOCK_ZONES } from "@/lib/data/mock";

export function DeliveryAreas() {
  return (
    <section
      id="delivery-areas"
      className="py-16 lg:py-20"
      style={{ backgroundColor: "var(--color-surface-2)" }}
      aria-labelledby="delivery-title"
    >
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">

          {/* Text side */}
          <Reveal>
            <div className="lg:sticky lg:top-24">
              <div className="inline-flex items-center gap-1.5 bg-sky-50 border border-sky-100 rounded-full px-3 py-1.5 mb-4">
                <Truck className="h-3.5 w-3.5 text-sky-500" aria-hidden="true" />
                <span className="text-xs font-semibold text-sky-600">אזורי משלוח</span>
              </div>

              <h2 id="delivery-title" className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                מגיעים לכל הארץ
              </h2>
              <p className="text-stone-500 leading-relaxed mb-8 text-lg">
                משלוחים לעשרות יישובים ברחבי ישראל.
                בחרו את האזור שלכם וראו את תנאי המשלוח – ממינימום מסוים המשלוח בחינם.
              </p>

              <div className="flex flex-col gap-3">
                {[
                  { icon: Clock, text: "משלוח עד 24–72 שעות, תלוי באזור" },
                  { icon: MapPin, text: "אפשרות לבחור שעת משלוח מועדפת" },
                  { icon: CheckCircle2, text: "משלוח חינם מהזמנה מינימלית" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-3 text-sm text-stone-600">
                    <div className="h-8 w-8 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-brand-600" aria-hidden="true" />
                    </div>
                    {text}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Zone cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MOCK_ZONES.map((zone, i) => (
              <Reveal key={zone.name} delay={i * 60}>
                <div className="group h-full p-4 rounded-2xl bg-white border border-stone-100 hover:border-brand-200 hover:shadow-md transition-all duration-300">
                  {/* Zone name + fee */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                        <MapPin className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
                      </div>
                      <h3 className="font-semibold text-gray-900 text-sm leading-tight">
                        {zone.name}
                      </h3>
                    </div>
                    <div className="text-end shrink-0">
                      <p className="text-sm font-bold text-brand-700 leading-tight">
                        {formatPrice(zone.fee)}
                      </p>
                      <p className="text-[11px] text-stone-400">משלוח</p>
                    </div>
                  </div>

                  <p className="text-xs text-stone-500 mb-3 leading-relaxed pe-1">
                    {zone.details}
                  </p>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-xs text-stone-400">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {zone.days}
                    </span>
                    <span className="text-xs font-semibold text-brand-600 bg-brand-50 rounded-full px-2 py-0.5">
                      חינם מ-{formatPrice(zone.freeFrom)}
                    </span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
