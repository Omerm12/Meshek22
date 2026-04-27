"use client";

import { useState, useCallback, useRef } from "react";
import Image from "next/image";
import { Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatPrice, formatPriceCompact } from "@/lib/utils/money";
import { useCart, calculateLineTotal } from "@/store/cart";
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

/** Round to the decimal precision implied by the step size. */
function roundToStep(value: number, step: number): number {
  const decimals = (step.toString().split(".")[1] ?? "").length;
  return parseFloat(value.toFixed(decimals));
}

/** Format a fractional quantity for display (removes unnecessary trailing zeros). */
function formatQty(qty: number): string {
  return parseFloat(qty.toFixed(3)).toString();
}

export function ProductCard({ product, className, priority = false }: ProductCardProps) {
  const { addItem, items, updateQty } = useCart();
  const { user } = useUser();
  const { requestAdd } = useDeliveryGate();
  const imageRef = useRef<HTMLDivElement>(null);

  const defaultVariant: MockVariant | undefined =
    product.variants.find((v) => v.isDefault) ?? product.variants[0];

  const [selectedVariant, setSelectedVariant] = useState<MockVariant | undefined>(defaultVariant);

  const cartItem = items.find((i) =>
    selectedVariant ? i.variantId === selectedVariant.id : false
  );
  const qty = cartItem?.quantity ?? 0;
  const isInCart = qty > 0;

  const handleAdd = useCallback(() => {
    if (!selectedVariant) return;
    const item = {
      variantId:           selectedVariant.id,
      productId:           product.id,
      productName:         product.name,
      variantLabel:        selectedVariant.label,
      priceAgorot:         selectedVariant.priceAgorot,
      imageUrl:            product.imageUrl,
      imageColor:          product.imageColor,
      productIcon:         product.icon,
      quantityPricingMode: selectedVariant.quantityPricingMode,
      quantityStep:        selectedVariant.quantityStep,
      minQuantity:         selectedVariant.minQuantity,
      quantity:            selectedVariant.minQuantity,
      dealEnabled:         product.dealEnabled,
      dealQuantity:        product.dealQuantity,
      dealPriceAgorot:     product.dealPriceAgorot,
    };
    if (!user && requestAdd(item)) return;
    addItem(item);
    if (imageRef.current) flyToCart(imageRef.current);
  }, [addItem, requestAdd, user, selectedVariant, product]);

  // Guard: product has no available variants — render nothing rather than crash.
  if (!selectedVariant) return null;

  // ── Stepper helpers ────────────────────────────────────────────────────────
  const step   = selectedVariant.quantityStep;
  const minQty = selectedVariant.minQuantity;

  const handleDecrement = () => {
    const next = roundToStep(qty - step, step);
    updateQty(selectedVariant.id, next < minQty ? 0 : next);
  };

  const handleIncrement = () => {
    updateQty(selectedVariant.id, roundToStep(qty + step, step));
  };

  const isPerKg = selectedVariant.quantityPricingMode === "per_kg";

  const hasDeal = product.dealEnabled && product.dealQuantity != null && product.dealPriceAgorot != null;

  const hasSale = selectedVariant.comparePriceAgorot !== null;
  const discountPct = hasSale
    ? Math.round(
        ((selectedVariant.comparePriceAgorot! - selectedVariant.priceAgorot) /
          selectedVariant.comparePriceAgorot!) *
          100,
      )
    : 0;

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
        "flex items-center gap-3 p-3 rounded-2xl",
        "md:flex-col md:gap-0 md:p-0 md:overflow-hidden md:rounded-2xl",
        isInCart
          ? "border-brand-300 shadow-[0_4px_24px_-4px_rgba(46,125,46,0.18)]"
          : "border-stone-100 shadow-sm md:hover:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)] md:hover:-translate-y-0.5",
        className,
      )}
    >
      {/* ── Image ──────────────────────────────────────────────────────────── */}
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

        {/* ── Deal badge: compact single-color pill ─────────────────────── */}
        {hasDeal && !hasSale && (
          <div className="absolute top-2 end-2 md:top-2.5 md:end-2.5 z-10 bg-orange-500 rounded-lg px-2 py-1 shadow-[0_2px_6px_rgba(234,88,12,0.45)]">
            <span className="text-[11px] md:text-[12px] font-black text-white leading-none tracking-tight whitespace-nowrap">
              {product.dealQuantity} ב-{formatPriceCompact(product.dealPriceAgorot!)}
            </span>
          </div>
        )}

        {/* ── Discount badge: "-20%" ─────────────────────────────────────── */}
        {hasSale && (
          <div className="absolute top-2 end-2 md:top-2.5 md:end-2.5 z-10 flex items-center justify-center bg-red-500 rounded-lg min-w-[38px] md:min-w-[44px] px-1.5 md:px-2 py-1 md:py-1.5 shadow-[0_3px_10px_rgba(220,38,38,0.5)]">
            <span className="text-[14px] md:text-[17px] font-black text-white leading-none tracking-tight tabular-nums">
              -{discountPct}%
            </span>
          </div>
        )}

        {isInCart && (
          <span
            className="absolute top-1.5 start-1.5 md:top-3 md:start-3 h-5 md:h-6 min-w-5 md:min-w-6 px-1 md:px-1.5 bg-brand-600 text-white text-[10px] md:text-xs font-bold rounded-full flex items-center justify-center animate-pop z-10"
            aria-label={`${formatQty(qty)}${isPerKg ? ' ק"ג' : ''} בסל`}
          >
            {formatQty(qty)}
          </span>
        )}
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 py-0.5 md:py-0 md:px-4 md:pt-3 md:pb-4">

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-1 md:gap-2 md:flex-1">
          <h3 className="font-bold text-gray-900 leading-snug text-sm md:text-[15px]">
            {product.name}
          </h3>

          {/* Variant chips — all screen sizes */}
          <div className="flex flex-wrap gap-1 items-start md:min-h-[26px]">
            {visibleVariants.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelectedVariant(v)}
                className={cn(
                  "px-2 md:px-2.5 py-0.5 rounded-full text-[11px] md:text-xs font-medium border transition-all duration-150 cursor-pointer",
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
        <div className="flex items-center gap-2 mt-2 md:mt-0 md:pt-3">

          {/* Price zone */}
          <div className="flex flex-col leading-none flex-1 min-w-0">
            {/* Current / sale price */}
            <span className={cn(
              "text-[17px] font-bold tracking-tight md:text-[22px] leading-none",
              hasSale ? "text-red-600" : "text-gray-900",
            )}>
              {formatPrice(selectedVariant.priceAgorot)}
              {isPerKg && (
                <span className="text-xs font-normal text-stone-400 ms-0.5">
                  /ק&quot;ג
                </span>
              )}
            </span>

            {/* Original price (strikethrough) */}
            {hasSale && (
              <span className="text-[11px] font-medium text-stone-400 line-through mt-1 leading-none">
                {formatPrice(selectedVariant.comparePriceAgorot!)}
              </span>
            )}

            {/* Live line total for per_kg or active deal */}
            {isInCart && (isPerKg || hasDeal) && cartItem && (
              <span className="text-xs text-brand-600 font-medium mt-1 leading-none">
                סה&quot;כ {formatPrice(calculateLineTotal(cartItem))}
              </span>
            )}
          </div>

          {/* Cart zone */}
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
                  onClick={handleDecrement}
                  aria-label="הפחת כמות"
                  className="h-7 w-7 md:h-8 md:w-8 shrink-0 flex items-center justify-center rounded-full text-white hover:bg-brand-500 active:bg-brand-700 transition-colors cursor-pointer"
                >
                  <Minus className="h-3 w-3 md:h-3.5 md:w-3.5" />
                </button>
                <span className="w-6 flex-shrink-0 md:flex-1 text-center text-sm font-bold text-white tabular-nums select-none">
                  {formatQty(qty)}
                </span>
                <button
                  onClick={handleIncrement}
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
