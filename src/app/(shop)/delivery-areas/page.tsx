import type { Metadata } from "next";
import { CalendarDays, PackageCheck, RefreshCw, MessageCircle, CheckCircle2, Clock } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { CategoryHero } from "@/components/shop/CategoryHero";
import { DeliveryChecker } from "@/components/shop/DeliveryChecker";
import { getCategoryHero } from "@/lib/config/category-heroes";
import { createAdminClient } from "@/lib/supabase/server";
import type { DeliveryZone } from "@/lib/delivery";

export const metadata: Metadata = {
  title: "אזורי משלוח | משק 22",
  description:
    "אנחנו מגיעים לעשרות יישובים ברחבי ישראל. בדקו האם אנחנו מגיעים לאזור שלכם, מה דמי המשלוח ומהי ההזמנה המינימלית.",
};

export default async function DeliveryAreasPage() {
  const hero = getCategoryHero("delivery");

  const adminClient = await createAdminClient();
  const [zonesRes, settlementsRes] = await Promise.all([
    adminClient
      .from("delivery_zones")
      .select("id, name, delivery_fee_agorot, free_delivery_threshold_agorot, min_order_agorot, estimated_delivery_hours")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    adminClient
      .from("settlements")
      .select("name, delivery_zone_id")
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);

  const zones = (zonesRes.data ?? []) as DeliveryZone[];
  const allSettlements = (settlementsRes.data ?? []) as { name: string; delivery_zone_id: string | null }[];

  return (
    <main className="flex-1">

      {/* Hero banner */}
      <CategoryHero config={hero} />

      {/* Delivery checker */}
      <div className="py-12 lg:py-16" style={{ backgroundColor: "var(--color-surface)" }}>
        <Container>
          <DeliveryChecker zones={zones} settlements={allSettlements} />
        </Container>
      </div>

      {/* Delivery policy section */}
      <div className="py-14 lg:py-20 bg-white border-t border-stone-100">
        <Container>
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">מדיניות ולוח זמנים</h2>
            <p className="text-lg text-stone-500 mb-10">כל מה שצריך לדעת לפני שמזמינים.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 mb-10">
              {[
                {
                  icon: Clock,
                  title: "שעת הגשת הזמנה",
                  body: "הזמנות שיתקבלו עד 12:00 יסופקו באותו היום.\nהזמנות לאחר השעה 12:00 יסופקו ביום העסקים הבא.",
                  bg: "#e0f2fe",
                  iconClass: "text-sky-600",
                },
                {
                  icon: CalendarDays,
                  title: "ימי משלוח",
                  body: "משלוחים מתבצעים בימים א׳–ו׳.\nאין משלוחים בשבת ובחגים.",
                  bg: "#f0fdf4",
                  iconClass: "text-brand-600",
                },
                {
                  icon: RefreshCw,
                  title: "שירות ואחריות",
                  body: "אנו עושים את מירב המאמצים לבחור עבורכם את התוצרת האיכותית ביותר.\nבמידה ויש בעיה בהזמנה – נשמח שתפנו אלינו ונטפל בכך בהתאם.",
                  bg: "#fef3c7",
                  iconClass: "text-amber-600",
                },
                {
                  icon: PackageCheck,
                  title: "קבלת המשלוח",
                  body: "ניצור איתכם קשר כאשר ההזמנה מוכנה,\nולפני יציאת השליח אליכם.",
                  bg: "#d1fae5",
                  iconClass: "text-emerald-600",
                },
              ].map(({ icon: Icon, title, body, bg, iconClass }) => (
                <div
                  key={title}
                  className="bg-stone-50 rounded-2xl border border-stone-100 p-6 sm:p-7"
                >
                  <div
                    className="h-11 w-11 rounded-xl flex items-center justify-center mb-4"
                    style={{ backgroundColor: bg }}
                  >
                    <Icon className={`h-6 w-6 ${iconClass}`} aria-hidden="true" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2 text-lg">{title}</h3>
                  <p className="text-base text-stone-500 leading-relaxed whitespace-pre-line">{body}</p>
                </div>
              ))}
            </div>

            {/* FAQ */}
            <div className="bg-brand-50 border border-brand-100 rounded-2xl p-7 sm:p-8">
              <div className="flex items-center gap-2 mb-5">
                <MessageCircle className="h-5 w-5 text-brand-600 shrink-0" />
                <h3 className="font-semibold text-brand-800 text-base">שאלות נפוצות</h3>
              </div>
              <ul className="space-y-4 text-base text-brand-700">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-brand-500 shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="leading-relaxed"><strong>איך מבצעים הזמנה?</strong> נכנסים לקטגוריות, בוחרים מוצרים ומוסיפים לסל. לאחר מכן משלימים את ההזמנה בעמוד התשלום.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-brand-500 shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="leading-relaxed"><strong>לאילו אזורים אתם מגיעים?</strong> אנחנו מבצעים משלוחים לאזורים המופיעים בעמוד זה. ניתן לבדוק לפי שם היישוב אם אנו מגיעים אליכם.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-brand-500 shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="leading-relaxed"><strong>מתי אקבל את ההזמנה?</strong> הזמנות עד 12:00 יסופקו באותו היום, והזמנות לאחר מכן – ביום העסקים הבא.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-brand-500 shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="leading-relaxed"><strong>איך ניתן ליצור קשר?</strong> ניתן ליצור קשר בטלפון או בוואטסאפ, ונשמח לעזור בכל שאלה.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-brand-500 shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="leading-relaxed"><strong>איך נבחרים המוצרים?</strong> כל המוצרים נבחרים בקפידה ונקטפים בסמוך לאספקה, כדי להבטיח טריות ואיכות גבוהה.</span>
                </li>
              </ul>
            </div>
          </div>
        </Container>
      </div>

    </main>
  );
}
