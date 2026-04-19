import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";

export function FinalCTA() {
  return (
    <section
      aria-labelledby="final-cta-title"
      className="overflow-hidden"
      style={{ backgroundColor: "var(--color-surface-2)" }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[560px] lg:min-h-[640px]">

        {/* ── Content column (visual RIGHT in RTL) ─────────────────────────── */}
        <div className="order-2 lg:order-1 flex items-center">
          <div className="w-full ps-6 sm:ps-12 lg:ps-16 xl:ps-20 pe-6 lg:pe-10 py-16 lg:py-24 text-right">

            <p className="text-sm font-bold text-brand-600 uppercase tracking-widest mb-5">
              משק 22 — ישירות מהשדה
            </p>

            <h2
              id="final-cta-title"
              className="font-bold text-gray-900 mb-6 leading-tight"
              style={{ fontSize: "clamp(2.8rem, 5vw, 4.2rem)" }}
            >
              מוכנים לאכול<br />
              טרי יותר?
            </h2>

            <p className="text-stone-500 text-xl leading-relaxed mb-2">
              הצטרפו לאלפי משפחות שקונות ממשק 22 כל שבוע.
            </p>
            <p className="text-stone-500 text-xl leading-relaxed mb-10">
              ירקות ופירות טריים, ישירות לבית שלכם.
            </p>

            <div className="flex flex-row flex-nowrap items-center justify-start gap-4">
              <Link
                href="/products"
                className={[
                  "inline-flex items-center gap-2.5 h-[56px] px-8 rounded-full shrink-0",
                  "bg-brand-600 text-white font-bold text-lg",
                  "hover:bg-brand-700 active:bg-brand-800",
                  "shadow-lg shadow-brand-600/25 hover:shadow-xl hover:shadow-brand-600/30",
                  "hover:-translate-y-0.5 transition-all duration-200",
                  "focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
                ].join(" ")}
              >
                הזמינו עכשיו
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              </Link>

              <Link
                href="/about"
                className={[
                  "inline-flex items-center gap-2 h-[56px] px-8 rounded-full shrink-0",
                  "border border-stone-300 text-stone-700 font-medium text-lg",
                  "hover:border-brand-400 hover:text-brand-700 hover:bg-brand-50",
                  "transition-all duration-200",
                ].join(" ")}
              >
                קראו עלינו
              </Link>
            </div>
          </div>
        </div>

        {/* ── Image column (visual LEFT in RTL) ── full-bleed ─────────────── */}
        <div className="order-1 lg:order-2 relative min-h-[340px] lg:min-h-0">
          <Image
            src="/images/heroes/photo-meshek22.png"
            alt="משק 22 — שדה חקלאי"
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover object-center"
            priority
          />
          <div
            className="absolute inset-y-0 end-0 w-28 pointer-events-none hidden lg:block"
            style={{
              background:
                "linear-gradient(to start, var(--color-surface-2) 0%, transparent 100%)",
            }}
            aria-hidden="true"
          />
        </div>

      </div>
    </section>
  );
}
