"use client";

import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/ui/Container";

export function FinalCTA() {
  const scrollToProducts = () => {
    document.getElementById("best-sellers")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      className="relative py-20 lg:py-28 overflow-hidden"
      aria-labelledby="final-cta-title"
    >
      {/* Background — dark forest green with depth */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(135deg, #1a4f1a 0%, #236523 40%, #2e7d2e 75%, #1e5c1e 100%)",
        }}
        aria-hidden="true"
      />

      {/* Texture dots overlay */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
        aria-hidden="true"
      />

      {/* Top-right glow */}
      <div
        className="pointer-events-none absolute -top-24 -end-24 h-[400px] w-[400px] rounded-full opacity-20"
        style={{ background: "radial-gradient(circle, #86d086, transparent 65%)" }}
        aria-hidden="true"
      />
      {/* Bottom-left glow */}
      <div
        className="pointer-events-none absolute -bottom-20 -start-20 h-[320px] w-[320px] rounded-full opacity-10"
        style={{ background: "radial-gradient(circle, #b8e8b8, transparent 65%)" }}
        aria-hidden="true"
      />

      <Container className="relative text-center">
        {/* Emoji */}
        <div className="text-5xl mb-6 animate-scale-in select-none" aria-hidden="true">🌿</div>

        <h2
          id="final-cta-title"
          className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 animate-fade-up"
        >
          מוכנים לאכול טרי?
        </h2>

        <p className="text-lg text-white/75 max-w-lg mx-auto mb-9 leading-relaxed animate-fade-up animate-delay-100">
          הצטרפו לאלפי משפחות שכבר קונות ממשק 22 כל שבוע.
          ירקות ופירות טריים, ישירות לבית שלכם.
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-4 animate-fade-up animate-delay-200">
          <button
            onClick={scrollToProducts}
            className={[
              "inline-flex items-center gap-2.5 h-[52px] px-8 rounded-full",
              "bg-white text-brand-800 font-bold text-base",
              "hover:bg-brand-50 active:bg-brand-100",
              "transition-all duration-200",
              "shadow-[0_4px_24px_-4px_rgba(255,255,255,0.35)]",
              "hover:shadow-[0_8px_32px_-4px_rgba(255,255,255,0.45)]",
              "cursor-pointer",
            ].join(" ")}
          >
            <ArrowLeft className="h-4 w-4 rotate-180" aria-hidden="true" />
            הזמינו עכשיו
          </button>

          <a
            href="/category/yerakot"
            className={[
              "inline-flex items-center gap-2 h-[52px] px-8 rounded-full",
              "border border-white/35 text-white/90 font-medium text-base",
              "hover:bg-white/10 hover:border-white/60",
              "transition-all duration-200",
            ].join(" ")}
          >
            צפו בכל הקטלוג
          </a>
        </div>

        {/* Social proof row */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-5 text-sm text-white/55 animate-fade-up animate-delay-300">
          <span className="flex items-center gap-1.5">
            <span className="text-amber-300">★★★★★</span>
            <span>דירוג 4.9</span>
          </span>
          <span className="text-white/20 hidden sm:block">|</span>
          <span>+5,000 לקוחות מרוצים</span>
          <span className="text-white/20 hidden sm:block">|</span>
          <span>משלוח לכל הארץ</span>
        </div>
      </Container>
    </section>
  );
}
