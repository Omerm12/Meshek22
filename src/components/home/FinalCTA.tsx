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
      {/*
        Full-bleed two-column grid.
        RTL: column 1 (DOM) = visual RIGHT = text content.
             column 2 (DOM) = visual LEFT  = image.
      */}
      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[480px] lg:min-h-[520px]">

        {/* ── Content column (visual RIGHT in RTL) ─────────────────────────── */}
        {/*
          In RTL, justify-start = visual right side of the column.
          This anchors the content block to the right (start) of the right half,
          not to the center divider.
        */}
        <div className="order-2 lg:order-1 flex items-center justify-start">
          {/*
            ps-6 sm:ps-10 lg:ps-12 xl:ps-16 = padding from the right (start) page edge.
            pe-6 lg:pe-8 = padding from the image boundary on the left (end) side.
            text-right: explicit RTL text alignment.
            max-w-lg: wide enough for clean Hebrew line breaks.
          */}
          <div
            className="w-full max-w-xl ps-6 sm:ps-10 lg:ps-12 xl:ps-16 pe-6 lg:pe-8 py-14 lg:py-20 text-right"
          >
            {/* Eyebrow */}
            <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-4">
              משק 22 — ישירות מהשדה
            </p>

            {/* Heading — max-w-xl gives enough room so it breaks only where natural */}
            <h2
              id="final-cta-title"
              className="font-bold text-gray-900 mb-5 leading-tight"
              style={{ fontSize: "clamp(2rem, 3.5vw, 2.8rem)" }}
            >
              מוכנים לאכול טרי יותר?
            </h2>

            {/* Two separate sentences — prevents the browser splitting mid-sentence */}
            <p className="text-stone-500 text-[1.0625rem] leading-relaxed mb-1">
              הצטרפו לאלפי משפחות שקונות ממשק 22 כל שבוע.
            </p>
            <p className="text-stone-500 text-[1.0625rem] leading-relaxed mb-8">
              ירקות ופירות טריים, ישירות לבית שלכם.
            </p>

            {/* CTA buttons — flex-row, nowrap, right-aligned */}
            <div className="flex flex-row flex-nowrap items-center justify-start gap-3 mb-10">
              <Link
                href="/products"
                className={[
                  "inline-flex items-center gap-2.5 h-[52px] px-7 rounded-full shrink-0",
                  "bg-brand-600 text-white font-bold text-base",
                  "hover:bg-brand-700 active:bg-brand-800",
                  "shadow-lg shadow-brand-600/25 hover:shadow-xl hover:shadow-brand-600/30",
                  "hover:-translate-y-0.5 transition-all duration-200",
                  "focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
                ].join(" ")}
              >
                <ArrowLeft className="h-4 w-4 rotate-180" aria-hidden="true" />
                הזמינו עכשיו
              </Link>

              <Link
                href="/about"
                className={[
                  "inline-flex items-center gap-2 h-[52px] px-7 rounded-full shrink-0",
                  "border border-stone-300 text-stone-700 font-medium text-base",
                  "hover:border-brand-400 hover:text-brand-700 hover:bg-brand-50",
                  "transition-all duration-200",
                ].join(" ")}
              >
                קראו עלינו
              </Link>
            </div>

            {/* Social proof — inherits text-right from parent, no extra justify needed */}
            <div className="text-sm text-stone-400 leading-loose">
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap me-4">
                <span className="text-amber-400">★★★★★</span>
                <span>דירוג 4.9</span>
              </span>
              <span className="whitespace-nowrap me-4">+5,000 לקוחות מרוצים</span>
              <span className="whitespace-nowrap">משלוח לכל הארץ</span>
            </div>
          </div>
        </div>

        {/* ── Image column (visual LEFT in RTL) ── full-bleed ─────────────── */}
        <div className="order-1 lg:order-2 relative min-h-[300px] lg:min-h-0">
          <Image
            src="/images/heroes/photo-meshek22.png"
            alt="משק 22 — ירקות ופירות טריים"
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover object-center"
            priority
          />
          {/* Right-edge fade into the content background */}
          <div
            className="absolute inset-y-0 end-0 w-20 pointer-events-none hidden lg:block"
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
