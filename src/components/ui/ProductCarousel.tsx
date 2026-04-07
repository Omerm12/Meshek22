"use client";

/**
 * ProductCarousel
 *
 * Renders a one-row horizontal scrollable carousel of ProductCards.
 * Works with RTL because:
 *   - The page root is dir="rtl"
 *   - scrollLeft in RTL is browser-specific; we use scrollBy() which works
 *     relative to the current scroll direction and is direction-aware.
 *   - Arrows are labelled with start/end (logical) context.
 *
 * Card width: fixed via CSS so cards never wrap.
 * Scrollbar: hidden visually via .carousel-track, still scrollable via touch/mouse.
 */

import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { ProductCard } from "@/components/shop/ProductCard";
import type { MockProduct } from "@/lib/data/mock";

interface ProductCarouselProps {
  products: MockProduct[];
  /** px width of each card. Default 236. */
  cardWidth?: number;
  /** px gap between cards. Default 16. */
  gap?: number;
}

export function ProductCarousel({
  products,
  cardWidth = 236,
  gap = 16,
}: ProductCarouselProps) {
  const trackRef    = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  // In RTL, scrollLeft is negative in Firefox/Chrome and positive in Safari.
  // scrollWidth - clientWidth - |scrollLeft| gives remaining scroll.
  const updateArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    // Normalise: in RTL browsers report negative scrollLeft, take absolute value
    const scrolled = Math.abs(scrollLeft);
    const maxScroll = scrollWidth - clientWidth;
    setCanPrev(scrolled > 4);
    setCanNext(scrolled < maxScroll - 4);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener("scroll", updateArrows, { passive: true });
    // Also update on resize
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      ro.disconnect();
    };
  }, [updateArrows]);

  // In RTL: scrolling "forward" (toward newer items at the end) means
  // scrolling in the negative direction. scrollBy() handles this correctly
  // because the browser scrolls in the appropriate direction for the layout.
  const scrollBy = useCallback((direction: "prev" | "next") => {
    const el = trackRef.current;
    if (!el) return;
    const amount = (cardWidth + gap) * 2; // scroll 2 cards at a time
    el.scrollBy({
      left: direction === "next" ? -amount : amount,
      behavior: "smooth",
    });
  }, [cardWidth, gap]);

  if (products.length === 0) return null;

  return (
    <div>
      {/* ── Mobile: vertical list of horizontal cards ──────────────────────── */}
      <div className="flex flex-col gap-2 md:hidden">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {/* ── Desktop: horizontal scroll carousel ───────────────────────────── */}
      <div className="hidden md:block relative">
      <div
        ref={trackRef}
        className="flex gap-4 overflow-x-auto scroll-smooth carousel-track-no-scrollbar"
        style={{
          // Hide the scrollbar visually while keeping scroll functional
          scrollbarWidth: "none",           // Firefox
          msOverflowStyle: "none",          // IE/Edge legacy
          paddingBottom: "4px",             // small breathing room for card shadows
        }}
        // Hide WebKit scrollbar
        // (cannot use className because Tailwind doesn't ship scrollbar-hide by default)
      >
        {products.map((product) => (
          <div
            key={product.id}
            className="shrink-0"
            style={{ width: cardWidth }}
          >
            <ProductCard product={product} />
          </div>
        ))}

        {/* Trailing spacer so the last card doesn't sit flush against the edge */}
        <div className="shrink-0 w-2" aria-hidden="true" />
      </div>

      {/* ── Edge fade overlays ────────────────────────────────────────────── */}
      {canPrev && (
        <div
          className="pointer-events-none absolute top-0 bottom-1 start-0 w-16 z-10"
          style={{
            background:
              "linear-gradient(to end, var(--color-surface-2) 0%, transparent 100%)",
          }}
          aria-hidden="true"
        />
      )}
      {canNext && (
        <div
          className="pointer-events-none absolute top-0 bottom-1 end-0 w-16 z-10"
          style={{
            background:
              "linear-gradient(to start, var(--color-surface-2) 0%, transparent 100%)",
          }}
          aria-hidden="true"
        />
      )}

      {/* ── Navigation arrows ─────────────────────────────────────────────── */}
      <button
        onClick={() => scrollBy("prev")}
        disabled={!canPrev}
        aria-label="גלול לפריטים הקודמים"
        className={cn(
          "absolute top-1/2 -translate-y-[60%] start-0 z-20",
          "h-10 w-10 flex items-center justify-center rounded-full",
          "bg-white border border-stone-200 shadow-md",
          "text-stone-600 hover:text-brand-700 hover:border-brand-300",
          "transition-all duration-150 cursor-pointer",
          "disabled:opacity-0 disabled:pointer-events-none",
          "-translate-x-1/2 rtl:translate-x-1/2",
        )}
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>

      <button
        onClick={() => scrollBy("next")}
        disabled={!canNext}
        aria-label="גלול לפריטים הבאים"
        className={cn(
          "absolute top-1/2 -translate-y-[60%] end-0 z-20",
          "h-10 w-10 flex items-center justify-center rounded-full",
          "bg-white border border-stone-200 shadow-md",
          "text-stone-600 hover:text-brand-700 hover:border-brand-300",
          "transition-all duration-150 cursor-pointer",
          "disabled:opacity-0 disabled:pointer-events-none",
          "translate-x-1/2 rtl:-translate-x-1/2",
        )}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>
      </div>{/* end desktop carousel wrapper */}
    </div>
  );
}
