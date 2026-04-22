"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { HERO_SLIDES } from "@/lib/config/hero-slides";

const TOTAL = HERO_SLIDES.length;
const INTERVAL_MS = 5000;

// ─── Individual slide panel ───────────────────────────────────────────────────

function SlidePanel({
  slide,
  isActive,
}: {
  slide: (typeof HERO_SLIDES)[number];
  isActive: boolean;
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 transition-opacity duration-700 ease-in-out select-none",
        isActive ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none",
      )}
      aria-hidden={!isActive}
    >
      {/* Background: image first, gradient as CSS fallback */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${slide.imagePath}), ${slide.backgroundGradient}`,
        }}
      />
      {/* Readability scrim */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-black/10" />

      {/* Content */}
      <div className="relative z-10 h-full flex items-center justify-center px-4">
        <div className="text-center text-white max-w-2xl mx-auto">
          {slide.badge && (
            <span className="inline-block bg-white/20 border border-white/30 text-white text-xs font-semibold rounded-full px-3.5 py-1 mb-5 backdrop-blur-sm tracking-wide">
              {slide.badge}
            </span>
          )}

          <h2
            className="font-bold leading-tight mb-4"
            style={{
              fontSize: "clamp(2.2rem, 5vw, 3.6rem)",
              textShadow: "0 2px 12px rgba(0,0,0,0.3)",
            }}
          >
            {slide.headline.split("\n").map((line, i) => (
              <span key={i} className="block">
                {line}
              </span>
            ))}
          </h2>

          <p
            className="text-white/85 leading-relaxed mb-7"
            style={{ fontSize: "clamp(1.05rem, 2vw, 1.25rem)" }}
          >
            {slide.subtext}
          </p>

          <Link
            href={slide.ctaHref}
            className="inline-flex items-center gap-2.5 h-12 px-8 rounded-full bg-white text-gray-900 font-semibold text-base hover:bg-white/90 active:bg-white/80 shadow-lg hover:-translate-y-0.5 hover:shadow-xl transition-all duration-200 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          >
            {slide.ctaLabel}
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Hero Section ─────────────────────────────────────────────────────────────

export function HeroSection() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused]   = useState(false);

  // Keep a ref in sync with paused so the interval callback can read the
  // latest value without needing the interval to be recreated.
  const pausedRef = useRef(false);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // Navigate to a specific slide
  const goTo = useCallback(
    (index: number) => setCurrent(((index % TOTAL) + TOTAL) % TOTAL),
    [],
  );

  // Stable navigation — functional setCurrent, never depends on `current`.
  const goNext = useCallback(() => setCurrent((c) => (c + 1) % TOTAL), []);
  const goPrev = useCallback(() => setCurrent((c) => (c - 1 + TOTAL) % TOTAL), []);

  // Single interval, started once on mount. Reads pausedRef each tick so it
  // never needs to be recreated when paused state changes.
  useEffect(() => {
    const id = setInterval(() => {
      if (!pausedRef.current) {
        setCurrent((c) => (c + 1) % TOTAL);
      }
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <section
      className="relative overflow-hidden w-full"
      style={{ height: "clamp(340px, 48vw, 520px)" }}
      aria-label="באנר קידום מכירות"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slides */}
      {HERO_SLIDES.map((slide, idx) => (
        <SlidePanel
          key={slide.id}
          slide={slide}
          isActive={idx === current}
        />
      ))}

      {/* ── Navigation arrows ─────────────────────────────────────────────── */}
      <button
        onClick={goPrev}
        className="absolute start-4 top-1/2 -translate-y-1/2 z-20 h-10 w-10 flex items-center justify-center rounded-full bg-white/80 hover:bg-white shadow-md text-gray-700 hover:text-brand-700 transition-all duration-150 cursor-pointer backdrop-blur-sm"
        aria-label="שקופית קודמת"
      >
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </button>
      <button
        onClick={goNext}
        className="absolute end-4 top-1/2 -translate-y-1/2 z-20 h-10 w-10 flex items-center justify-center rounded-full bg-white/80 hover:bg-white shadow-md text-gray-700 hover:text-brand-700 transition-all duration-150 cursor-pointer backdrop-blur-sm"
        aria-label="שקופית הבאה"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </button>

      {/* ── Dot indicators ────────────────────────────────────────────────── */}
      <div
        className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2"
        role="tablist"
        aria-label="ניווט שקופיות"
      >
        {HERO_SLIDES.map((slide, idx) => (
          <button
            key={slide.id}
            onClick={() => goTo(idx)}
            role="tab"
            aria-selected={idx === current}
            aria-label={`שקופית ${idx + 1}: ${slide.ctaLabel}`}
            className={cn(
              "rounded-full transition-all duration-300 cursor-pointer",
              idx === current
                ? "w-6 h-2.5 bg-white shadow"
                : "w-2.5 h-2.5 bg-white/50 hover:bg-white/75",
            )}
          />
        ))}
      </div>

      {/* ── Progress bar ──────────────────────────────────────────────────── */}
      {!paused && (
        <div
          key={current}
          className="absolute bottom-0 start-0 h-0.5 bg-white/60 z-20"
          style={{ animation: `heroProgress ${INTERVAL_MS}ms linear forwards` }}
          aria-hidden="true"
        />
      )}

      <style>{`
        @keyframes heroProgress {
          from { width: 0%; }
          to   { width: 100%; }
        }
      `}</style>
    </section>
  );
}
