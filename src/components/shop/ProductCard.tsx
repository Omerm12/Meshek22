"use client";

import { useState, useCallback, useRef } from "react";
import Image from "next/image";
import { Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatPrice } from "@/lib/utils/money";
import { useCart } from "@/store/cart";
import { useUser } from "@/store/user";
import { useDeliveryGate } from "@/store/delivery-gate";
import { flyToCart } from "@/lib/utils/fly-to-cart";
import supabaseImageLoader from "@/lib/utils/supabase-image-loader";
import type { MockProduct, MockVariant } from "@/lib/data/mock";

interface ProductCardProps {
  product: MockProduct;
  className?: string;
  /** Pass true for cards visible above the fold — triggers browser preload. */
  priority?: boolean;
}

export function ProductCard({ product, className, priority = false }: ProductCardProps) {
  const { addItem, items, updateQty } = useCart();
  const { user } = useUser();
  const { requestAdd } = useDeliveryGate();
  const imageRef = useRef<HTMLDivElement>(null);

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
    const item = {
      variantId:    selectedVariant.id,
      productId:    product.id,
      productName:  product.name,
      variantLabel: selectedVariant.label,
      priceAgorot:  selectedVariant.priceAgorot,
      imageUrl:     product.imageUrl,
      imageColor:   product.imageColor,
      productIcon:  product.icon,
    };

    if (!user && requestAdd(item)) return;

    addItem(item);
    if (imageRef.current) flyToCart(imageRef.current);
  }, [addItem, requestAdd, user, selectedVariant, product]);

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
        // Mobile: horizontal card — RTL flex-row puts image at START (right) and content at END (left)
        "flex items-center gap-3 p-3 rounded-2xl",
        // Desktop: vertical card
        "md:flex-col md:gap-0 md:p-0 md:overflow-hidden md:rounded-2xl",
        isInCart
          ? "border-brand-300 shadow-[0_4px_24px_-4px_rgba(46,125,46,0.18)]"
          : "border-stone-100 shadow-sm md:hover:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)] md:hover:-translate-y-0.5",
        className,
      )}
    >
      {/* ── Image ──────────────────────────────────────────────────────────── */}
      {/* data-fly-* read by flyToCart to produce a non-white fallback circle */}
      <div
        ref={imageRef}
        style={imageBg}
        data-fly-color={product.imageColor}
        data-fly-icon={product.icon}
        className={cn(
          "relative w-28 h-28 shrink-0 overflow-hidden rounded-xl block bg-stone-50",
          "md:w-full md:h-auto md:aspect-[4/3] md:rounded-t-2xl md:rounded-b-none md:shrink md:bg-transparent",
        )}
      >
        {hasImage ? (
          <Image
            loader={supabaseImageLoader}
            src={product.imageUrl!}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 112px, (max-width: 1024px) 33vw, 260px"
            priority={priority}
            className="object-contain transition-transform duration-500 ease-out group-hover:scale-105"
          />
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

        {hasSale && (
          <span className="absolute top-1.5 end-1.5 md:top-3 md:end-3 bg-red-500 text-white text-[10px] md:text-[11px] font-bold rounded-full px-1.5 py-0.5 leading-none z-10">
            -{discountPct}%
          </span>
        )}

        {isInCart && (
          <span
            className="absolute top-1.5 start-1.5 md:top-3 md:start-3 h-5 md:h-6 min-w-5 md:min-w-6 px-1 md:px-1.5 bg-brand-600 text-white text-[10px] md:text-xs font-bold rounded-full flex items-center justify-center animate-pop z-10"
            aria-label={`${qty} בסל`}
          >
            {qty}
          </span>
        )}
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 py-0.5 md:py-0 md:px-4 md:pt-3 md:pb-4">

        {/* ── Body ────────────────────────────────────────────────────────── */}
        {/* md:flex-1 makes the body grow to fill available vertical space,
            which pins the footer to the card bottom regardless of chip count. */}
        <div className="flex flex-col gap-1 md:gap-2 md:flex-1">
          <h3 className="font-bold text-gray-900 leading-snug text-sm md:text-[15px]">
            {product.name}
          </h3>

          {/* Variant label — mobile only */}
          <p className="text-xs text-stone-400 md:hidden truncate">
            {selectedVariant.label}
          </p>

          {/* Variant chips — desktop only.
              min-h-[26px] reserves space so single-chip cards don't collapse. */}
          <div className="hidden md:flex flex-wrap gap-1 items-start min-h-[26px]">
            {visibleVariants.map((v) => (
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
            ))}
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        {/* Completely independent of chip count.
            Price zone (flex-1) fills the right — RTL text-align pins text to the right edge.
            Cart zone (shrink-0) is pinned to the left.
            Both anchors are stable across every product, 1 tag or 5. */}
        <div className="flex items-center gap-2 mt-2 md:mt-0 md:pt-3">

          {/* Price zone — fills remaining width; RTL default right-aligns text */}
          <div className="flex flex-col leading-none flex-1 min-w-0">
            <span className="text-[17px] font-bold text-gray-900 tracking-tight md:text-[22px]">
              {formatPrice(selectedVariant.priceAgorot)}
            </span>
            {hasSale && (
              <span className="text-xs text-stone-400 line-through mt-0.5">
                {formatPrice(selectedVariant.comparePriceAgorot!)}
              </span>
            )}
          </div>

          {/* Cart zone — LEFT anchor.
              Desktop: fixed 100px so circle↔pill never shifts the price.
              Mobile: natural width. */}
          <div className="shrink-0 flex items-center justify-end md:w-[100px]">
            {qty === 0 ? (
              <button
                onClick={handleAdd}
                aria-label={`הוסף ${product.name} לסל`}
                className={cn(
                  "h-8 w-8 md:h-9 md:w-9",
                  "flex items-center justify-center rounded-full",
                  "bg-brand-600 text-white shadow-sm",
                  "hover:bg-brand-700 active:scale-90",
                  "transition-all duration-150 cursor-pointer",
                  "focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
                )}
              >
                <Plus className="h-4 w-4 md:h-[18px] md:w-[18px]" aria-hidden="true" />
              </button>
            ) : (
              <div className="flex items-center gap-0.5 bg-brand-600 rounded-full p-0.5 shadow-sm md:w-full">
                <button
                  onClick={() => updateQty(selectedVariant.id, qty - 1)}
                  aria-label="הפחת כמות"
                  className="h-7 w-7 md:h-8 md:w-8 shrink-0 flex items-center justify-center rounded-full text-white hover:bg-brand-500 active:bg-brand-700 transition-colors cursor-pointer"
                >
                  <Minus className="h-3 w-3 md:h-3.5 md:w-3.5" />
                </button>
                <span className="w-6 flex-shrink-0 md:flex-1 text-center text-sm font-bold text-white tabular-nums select-none">
                  {qty}
                </span>
                <button
                  onClick={() => updateQty(selectedVariant.id, qty + 1)}
                  aria-label="הוסף כמות"
                  className="h-7 w-7 md:h-8 md:w-8 shrink-0 flex items-center justify-center rounded-full text-white hover:bg-brand-500 active:bg-brand-700 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-1 focus-visible:ring-offset-brand-600"
                >
                  <Plus className="h-3 w-3 md:h-3.5 md:w-3.5" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </article>
  );
}
