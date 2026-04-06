"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatPrice } from "@/lib/utils/money";
import { useCart } from "@/store/cart";
import type { MockProduct, MockVariant } from "@/lib/data/mock";

interface ProductCardProps {
  product: MockProduct;
  className?: string;
}

export function ProductCard({ product, className }: ProductCardProps) {
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
      imageColor: product.imageColor,
      productIcon: product.icon,
    });
  }, [addItem, selectedVariant, product]);

  // Show max 3 variants to keep card compact
  const visibleVariants = product.variants.slice(0, 3);
  const hasImage = !!product.imageUrl;

  return (
    <article
      className={cn(
        "group relative bg-white rounded-2xl overflow-hidden flex flex-col",
        "border transition-all duration-300",
        isInCart
          ? "border-brand-300 shadow-[0_4px_24px_-4px_rgba(46,125,46,0.18)]"
          : "border-stone-100 shadow-sm hover:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)] hover:-translate-y-0.5",
        className,
      )}
    >
      {/* ── Image area ─────────────────────────────────────────────────────── */}
      <Link
        href={`/product/${product.slug}`}
        className="relative w-full aspect-[16/9] overflow-hidden block rounded-t-2xl"
        tabIndex={-1}
        aria-hidden="true"
        style={!hasImage ? {
          background: `radial-gradient(ellipse at 50% 70%, ${product.imageColor} 0%, color-mix(in srgb, ${product.imageColor} 55%, white) 100%)`,
        } : undefined}
      >
        {hasImage ? (
          <>
            {/* Background layer (fills width, creates premium feel) */}
            <Image
              src={product.imageUrl!}
              alt=""
              fill
              aria-hidden="true"
              className="object-cover scale-125 blur-2xl opacity-30"
            />

            {/* Foreground image (FULL image, no cropping) */}
            <Image
              src={product.imageUrl!}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 260px"
              className="object-contain z-10 transition-transform duration-500 ease-out group-hover:scale-105"
            />
          </>
        ) : (
          /* Emoji fallback when no image uploaded */
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="text-7xl leading-none select-none transition-transform duration-500 ease-out group-hover:scale-110"
              aria-hidden="true"
            >
              {product.icon}
            </span>
          </div>
        )}

        {/* Sale badge */}
        {hasSale && (
          <span className="absolute top-3 end-3 bg-red-500 text-white text-[11px] font-bold rounded-full px-2 py-0.5 leading-none z-10">
            -{discountPct}%
          </span>
        )}

        {/* In-cart quantity indicator */}
        {isInCart && (
          <span
            className="absolute top-3 start-3 h-6 min-w-6 px-1.5 bg-brand-600 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pop z-10"
            aria-label={`${qty} בסל`}
          >
            {qty}
          </span>
        )}
      </Link>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 px-4 pt-3 pb-4 gap-2">
        {/* Category */}
        <p className="text-[11px] font-medium text-warm-muted uppercase tracking-wider">
          {product.categoryName}
        </p>

        {/* Name */}
        <Link href={`/product/${product.slug}`}>
          <h3 className="font-bold text-gray-900 text-[15px] leading-snug hover:text-brand-700 transition-colors duration-200">
            {product.name}
          </h3>
        </Link>

        {/* Variant selector — always visible so customer knows what they're buying */}
        <div className="flex flex-wrap gap-1">
          {product.variants.length === 1 ? (
            /* Single variant: static pill, styled green so it reads as "selected" */
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium border bg-brand-600 text-white border-brand-600">
              {selectedVariant.label}
            </span>
          ) : (
            /* Multiple variants: interactive selector (max 3 shown) */
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

        {/* Spacer */}
        <div className="flex-1" />

        {/* ── Price + cart control ──────────────────────────────────────── */}
        <div className="flex items-end justify-between gap-2 pt-1">
          {/* Price */}
          <div className="flex flex-col leading-none">
            <span className="text-[22px] font-bold text-gray-900 tracking-tight">
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
                "h-10 w-10 shrink-0 rounded-full flex items-center justify-center",
                "bg-brand-600 text-white",
                "hover:bg-brand-700 active:scale-90",
                "transition-all duration-150 shadow-sm cursor-pointer",
                "focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
              )}
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : (
            <div className="flex items-center gap-0.5 bg-brand-600 rounded-full p-0.5 shadow-sm">
              <button
                onClick={() => updateQty(selectedVariant.id, qty - 1)}
                aria-label="הפחת כמות"
                className="h-8 w-8 flex items-center justify-center rounded-full text-white hover:bg-brand-500 active:bg-brand-700 transition-colors cursor-pointer"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-7 text-center text-sm font-bold text-white tabular-nums">
                {qty}
              </span>
              <button
                onClick={() => updateQty(selectedVariant.id, qty + 1)}
                aria-label="הוסף כמות"
                className="h-8 w-8 flex items-center justify-center rounded-full text-white hover:bg-brand-500 active:bg-brand-700 transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
