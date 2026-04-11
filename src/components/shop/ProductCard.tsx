"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatPrice } from "@/lib/utils/money";
import { useCart } from "@/store/cart";
import supabaseImageLoader from "@/lib/utils/supabase-image-loader";
import type { MockProduct, MockVariant } from "@/lib/data/mock";

interface ProductCardProps {
  product: MockProduct;
  className?: string;
  /** Pass true for cards that are visible above the fold — triggers browser preload. */
  priority?: boolean;
}

export function ProductCard({ product, className, priority = false }: ProductCardProps) {
  const { addItem, items, updateQty } = useCart();

  const defaultVariant = product.variants.find((v) => v.isDefault) ?? product.variants[0];
  const [selectedVariant, setSelectedVariant] = useState<MockVariant>(defaultVariant);

  const cartItem = items.find((i) => i.variantId === selectedVariant.id);
  const qty = cartItem?.quantity ?? 0;
  const isInCart = qty > 0;

  const hasSale = selectedVariant.comparePriceAgorot !== null;
  const discountPct = hasSale
    ? Math.round(
        ((selectedVariant.comparePriceAgorot! - selectedVariant.priceAgorot) /
          selectedVariant.comparePriceAgorot!) *
          100,
      )
    : 0;

  const handleAdd = useCallback(() => {
    addItem({
      variantId: selectedVariant.id,
      productId: product.id,
      productName: product.name,
      variantLabel: selectedVariant.label,
      priceAgorot: selectedVariant.priceAgorot,
      imageUrl: product.imageUrl,
      imageColor: product.imageColor,
      productIcon: product.icon,
    });
  }, [addItem, selectedVariant, product]);

  // Show max 3 variants to keep card compact
  const visibleVariants = product.variants.slice(0, 3);
  const hasImage = !!product.imageUrl;

  const imageBg = !hasImage
    ? {
        background: `radial-gradient(ellipse at 50% 70%, ${product.imageColor} 0%, color-mix(in srgb, ${product.imageColor} 55%, white) 100%)`,
      }
    : undefined;

  return (
    <article
      className={cn(
        "group relative bg-white border transition-all duration-300",
        // ── Mobile: horizontal card ──────────────────────────────────────────
        "flex flex-row-reverse items-center gap-3 p-3 rounded-2xl",
        // ── Desktop: vertical card (keep as-is) ─────────────────────────────
        "md:flex-col md:gap-0 md:p-0 md:overflow-hidden md:rounded-2xl",
        isInCart
          ? "border-brand-300 shadow-[0_4px_24px_-4px_rgba(46,125,46,0.18)]"
          : "border-stone-100 shadow-sm md:hover:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)] md:hover:-translate-y-0.5",
        className,
      )}
    >
      {/* ── Image ─────────────────────────────────────────────────────────── */}
      <div
        style={imageBg}
        className={cn(
          // Mobile: square thumbnail on the right, stone-50 bg so object-contain image has a clean backdrop
          "relative w-28 h-28 shrink-0 overflow-hidden rounded-xl block bg-stone-50",
          // Desktop: full-width banner on top (bg handled by the blurred layer)
          "md:w-full md:h-auto md:aspect-[16/9] md:rounded-t-2xl md:rounded-b-none md:shrink md:bg-transparent",
        )}
      >
        {hasImage ? (
          <>
            {/* Blurred background layer — desktop only (too noisy on small mobile thumbnail) */}
            <Image
              loader={supabaseImageLoader}
              src={product.imageUrl!}
              alt=""
              fill
              sizes="(max-width: 1024px) 33vw, 260px"
              aria-hidden="true"
              className="hidden md:block object-cover scale-125 blur-2xl opacity-30"
            />
            <Image
              loader={supabaseImageLoader}
              src={product.imageUrl!}
              alt={product.name}
              fill
              sizes="(max-width: 768px) 112px, (max-width: 1024px) 33vw, 260px"
              priority={priority}
              className="object-contain z-10 transition-transform duration-500 ease-out group-hover:scale-105"
            />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="text-4xl md:text-7xl leading-none select-none transition-transform duration-500 ease-out group-hover:scale-110"
              aria-hidden="true"
            >
              {product.icon}
            </span>
          </div>
        )}

        {/* Sale badge */}
        {hasSale && (
          <span className="absolute top-1.5 end-1.5 md:top-3 md:end-3 bg-red-500 text-white text-[10px] md:text-[11px] font-bold rounded-full px-1.5 py-0.5 leading-none z-10">
            -{discountPct}%
          </span>
        )}

        {/* In-cart indicator */}
        {isInCart && (
          <span
            className="absolute top-1.5 start-1.5 md:top-3 md:start-3 h-5 md:h-6 min-w-5 md:min-w-6 px-1 md:px-1.5 bg-brand-600 text-white text-[10px] md:text-xs font-bold rounded-full flex items-center justify-center animate-pop z-10"
            aria-label={`${qty} בסל`}
          >
            {qty}
          </span>
        )}
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div
        className={cn(
          "flex flex-col flex-1 min-w-0",
          // Mobile: tight vertical stack, no extra padding
          "gap-1 py-0.5",
          // Desktop: restore original spacing
          "md:gap-2 md:py-0 md:px-4 md:pt-3 md:pb-4",
        )}
      >
        {/* Category — desktop only (too noisy on compact mobile card) */}
        <p className="hidden md:block text-[11px] font-medium text-warm-muted uppercase tracking-wider">
          {product.categoryName}
        </p>

        {/* Name */}
        <h3
          className={cn(
            "font-bold text-gray-900 leading-snug",
            "text-sm md:text-[15px]",
          )}
        >
          {product.name}
        </h3>

        {/* Variant — mobile: selected label only; desktop: interactive selector */}
        <p className="text-xs text-stone-400 md:hidden truncate">
          {selectedVariant.label}
        </p>

        <div className="hidden md:flex flex-wrap gap-1">
          {product.variants.length === 1 ? (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium border bg-brand-600 text-white border-brand-600">
              {selectedVariant.label}
            </span>
          ) : (
            visibleVariants.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelectedVariant(v)}
                className={cn(
                  "px-2.5 py-0.5 rounded-full text-xs font-medium border transition-all duration-150 cursor-pointer",
                  selectedVariant.id === v.id
                    ? "bg-brand-600 text-white border-brand-600"
                    : "bg-white text-stone-500 border-stone-200 hover:border-brand-300 hover:text-brand-700",
                )}
              >
                {v.label}
              </button>
            ))
          )}
        </div>

        {/* Spacer (desktop only — pushes price to bottom of card) */}
        <div className="hidden md:block flex-1" />

        {/* ── Price + cart ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-2 md:items-end md:pt-1">
          {/* Price */}
          <div className="flex flex-col leading-none">
            <span className="text-[17px] font-bold text-gray-900 tracking-tight md:text-[22px]">
              {formatPrice(selectedVariant.priceAgorot)}
            </span>
            {hasSale && (
              <span className="text-xs text-stone-400 line-through mt-0.5">
                {formatPrice(selectedVariant.comparePriceAgorot!)}
              </span>
            )}
          </div>

          {/* Cart button */}
          {qty === 0 ? (
            <button
              onClick={handleAdd}
              aria-label={`הוסף ${product.name} לסל`}
              className={cn(
                // Mobile: slightly smaller
                "h-8 w-8 md:h-10 md:w-10",
                "shrink-0 rounded-full flex items-center justify-center",
                "bg-brand-600 text-white",
                "hover:bg-brand-700 active:scale-90",
                "transition-all duration-150 shadow-sm cursor-pointer",
                "focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
              )}
            >
              <Plus className="h-4 w-4 md:h-5 md:w-5" aria-hidden="true" />
            </button>
          ) : (
            <div className="flex items-center gap-0.5 bg-brand-600 rounded-full p-0.5 shadow-sm">
              <button
                onClick={() => updateQty(selectedVariant.id, qty - 1)}
                aria-label="הפחת כמות"
                className="h-7 w-7 md:h-8 md:w-8 flex items-center justify-center rounded-full text-white hover:bg-brand-500 active:bg-brand-700 transition-colors cursor-pointer"
              >
                <Minus className="h-3 w-3 md:h-3.5 md:w-3.5" />
              </button>
              <span className="w-6 md:w-7 text-center text-sm font-bold text-white tabular-nums">
                {qty}
              </span>
              <button
                onClick={() => updateQty(selectedVariant.id, qty + 1)}
                aria-label="הוסף כמות"
                className="h-7 w-7 md:h-8 md:w-8 flex items-center justify-center rounded-full text-white hover:bg-brand-500 active:bg-brand-700 transition-colors cursor-pointer"
              >
                <Plus className="h-3 w-3 md:h-3.5 md:w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
