"use client";

import { ArrowLeft, Star, Leaf, CheckCircle2, Truck } from "lucide-react";
import { Container } from "@/components/ui/Container";

function HeroVisual() {
  return (
    <div className="relative w-full max-w-[340px] mx-auto" aria-hidden="true">
      {/* Outer soft halo — adds depth behind the circle */}
      <div
        className="absolute inset-[-14px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(184,232,184,0.28) 55%, transparent 78%)",
        }}
      />

      {/* Main circle */}
      <div
        className="aspect-square rounded-full relative overflow-hidden"
        style={{
          background:
            "radial-gradient(circle at 38% 34%, #edf9ed 0%, #cdeacd 48%, #a8d8a8 100%)",
          boxShadow:
            "0 0 0 7px rgba(255,255,255,0.85), " +
            "inset 0 -28px 56px -14px rgba(46,125,46,0.10), " +
            "0 28px 72px -12px rgba(46,125,46,0.20), " +
            "0 8px 24px -4px rgba(46,125,46,0.10)",
        }}
      >
        {/* Emoji */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[8rem] leading-none select-none drop-shadow-sm animate-scale-in animate-delay-200">
            🥬
          </span>
        </div>
        {/* Light reflection overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 58% 28%, rgba(255,255,255,0.22) 0%, transparent 55%)",
          }}
        />
      </div>

      {/* Floating card 1 — freshness (top-end) */}
      <div className="absolute top-5 -end-6 flex items-center gap-2.5 bg-white/96 backdrop-blur-sm rounded-2xl border border-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.12)] px-3.5 py-3 animate-fade-up animate-delay-300">
        <div className="relative h-8 w-8 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
          <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-brand-400 opacity-50" />
          <span className="relative h-2.5 w-2.5 rounded-full bg-brand-500" />
        </div>
        <div>
          <p className="text-[10px] text-stone-400 leading-none mb-0.5">
            קטיף יומי
          </p>
          <p className="text-[13px] font-bold text-gray-900 leading-none">
            טרי מהשדה
          </p>
        </div>
      </div>

      {/* Floating card 2 — delivery (start side) */}
      <div className="absolute bottom-24 -start-8 flex items-center gap-2.5 bg-white/96 backdrop-blur-sm rounded-2xl border border-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.12)] px-3.5 py-3 animate-fade-up animate-delay-500">
        <div className="h-8 w-8 rounded-xl bg-sky-50 flex items-center justify-center shrink-0">
          <Truck className="h-4 w-4 text-sky-500" aria-hidden="true" />
        </div>
        <div>
          <p className="text-[10px] text-stone-400 leading-none mb-0.5">
            משלוח מהיר
          </p>
          <p className="text-[13px] font-bold text-gray-900 leading-none">
            עד 24 שעות
          </p>
        </div>
      </div>

      {/* Rating card (bottom-end) */}
      <div className="absolute -bottom-6 end-0 bg-white rounded-2xl shadow-[0_8px_32px_-6px_rgba(0,0,0,0.14)] border border-stone-100 px-4 py-3 flex items-center gap-3 animate-scale-in animate-delay-400">
        <div className="h-9 w-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
          <Star className="h-[18px] w-[18px] text-amber-400 fill-amber-400" />
        </div>
        <div>
          <p className="text-[10px] text-stone-400 leading-none mb-0.5">
            דירוג לקוחות
          </p>
          <p className="font-bold text-gray-900 text-[13px] leading-none">
            4.9 ★ מ-1,200 ביקורות
          </p>
        </div>
      </div>

      {/* Decorative dots */}
      <div className="absolute top-8 start-8 h-2.5 w-2.5 rounded-full bg-brand-300 opacity-50" />
      <div className="absolute bottom-12 end-8 h-2 w-2 rounded-full bg-brand-400 opacity-35" />
    </div>
  );
}

export function HeroSection() {
  return (
    <section
      className="relative overflow-hidden"
      style={{
        background:
          "linear-gradient(155deg, #f3faf2 0%, var(--color-surface) 52%, #fdf7f0 100%)",
      }}
      aria-label="ברוך הבא למשק 22"
    >
      {/* Top-end brand glow */}
      <div
        className="pointer-events-none absolute -top-28 -end-28 h-[520px] w-[520px] rounded-full opacity-[0.20]"
        style={{
          background:
            "radial-gradient(circle, var(--color-brand-200), transparent 65%)",
        }}
        aria-hidden="true"
      />
      {/* Bottom-start warm glow */}
      <div
        className="pointer-events-none absolute -bottom-20 -start-20 h-[440px] w-[440px] rounded-full opacity-[0.28]"
        style={{
          background: "radial-gradient(circle, #fef3c7, transparent 65%)",
        }}
        aria-hidden="true"
      />

      <Container className="relative">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-20 py-14 lg:py-24 items-center">
          {/* ── Text side ── */}
          <div className="order-2 lg:order-1 text-center lg:text-right">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 bg-brand-50/80 border border-brand-100 rounded-full px-4.5 py-2.5 mb-7 animate-fade-up">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-500 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-600" />
              </span>
              <span className="text-sm font-medium text-brand-700">
                קטיף יומי · ישירות מהמשק
              </span>
            </div>

            {/* Headline */}
            <h1
              className="font-bold text-gray-900 mb-7 animate-fade-up animate-delay-100"
              style={{
                fontSize: "clamp(2.4rem, 5vw, 3.6rem)",
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
              }}
            >
              <span className="block w-fit mx-auto lg:ml-auto lg:mr-0">
                נקטף הבוקר.
              </span>
              <span
                className="block w-fit mx-auto lg:ml-auto lg:mr-0 text-brand-600 mt-2"
                style={{
                  paddingBottom: "0.26em",
                  backgroundImage:
                    "linear-gradient(90deg, var(--color-brand-200), var(--color-brand-300, #86efac))",
                  backgroundSize: "100% 2px",
                  backgroundPosition: "0 100%",
                  backgroundRepeat: "no-repeat",
                }}
              >
                אצלכם הערב.
              </span>
            </h1>

            {/* Subheading */}
            <div className="mb-9 animate-fade-up animate-delay-200">
              <p className="block w-fit mx-auto lg:ml-auto lg:mr-0 text-[1.0625rem] text-stone-500 leading-relaxed">
                מהשדה ישירות לבית שלכם — ללא מחסנים, ללא מתווכים.
              </p>
            </div>

            {/* CTAs — one dominant hero button + plain text secondary */}
            <div className="flex flex-wrap items-center gap-5 justify-center lg:justify-end mb-9 animate-fade-up animate-delay-300">
              <button
                onClick={() =>
                  document
                    .getElementById("best-sellers")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
                className="inline-flex items-center justify-center gap-2.5 h-[52px] px-9 rounded-full bg-brand-600 text-white font-semibold text-base hover:bg-brand-700 active:bg-brand-800 shadow-lg shadow-brand-600/25 hover:shadow-xl hover:shadow-brand-600/30 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer select-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              >
                הזמינו עכשיו
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <a
                href="#about"
                className="inline-flex items-center gap-1.5 text-stone-400 hover:text-brand-700 transition-colors text-sm font-medium"
              >
                הכירו את המשק
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>

          {/* ── Visual side ── */}
          <div className="order-1 lg:order-2 flex items-center justify-center px-8 sm:px-16 lg:px-4 animate-scale-in animate-delay-200">
            <HeroVisual />
          </div>
        </div>
      </Container>
    </section>
  );
}
