"use client";

import { useState, useCallback, useRef } from "react";
import Image from "next/image";
import { Plus, Minus, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatPrice, formatPriceCompact } from "@/lib/utils/money";
import { useCart, calculateLineTotal } from "@/store/cart";
import { useUser } from "@/store/user";
import { useDeliveryGate } from "@/store/delivery-gate";
import { flyToCart } from "@/lib/utils/fly-to-cart";
import supabaseImageLoader from "@/lib/utils/supabase-image-loader";
import type { MockProduct, MockVariant } from "@/lib/data/mock";

interface SearchProductCardProps {
  product: MockProduct;
  /** Called when the user taps the secondary navigate arrow */
  onNavigate: (productName: string) => void;
}

function roundToStep(value: number, step: number): number {
  const decimals = (step.toString().split(".")[1] ?? "").length;
  return parseFloat(value.toFixed(decimals));
}

function formatQty(qty: number): string {
  return parseFloat(qty.toFixed(3)).toString();
}

export function SearchProductCard({ product, onNavigate }: SearchProductCardProps) {
  const { addItem, items, updateQty } = useCart();
  const { user } = useUser();
  const { requestAdd } = useDeliveryGate();
  const imageRef = useRef<HTMLDivElement>(null);

  const defaultVariant = product.variants.find((v) => v.isDefault) ?? product.variants[0];
  const [selectedVariant, setSelectedVariant] = useState<MockVariant | undefined>(defaultVariant);

  const cartItem = items.find((i) => selectedVariant ? i.variantId === selectedVariant.id : false);
  const qty   = cartItem?.quantity ?? 0;
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

  if (!selectedVariant) return null;

  const step   = selectedVariant.quantityStep;
  const minQty = selectedVariant.minQuantity;

  const handleDecrement = () => {
    const next = roundToStep(qty - step, step);
    updateQty(selectedVariant.id, next < minQty ? 0 : next);
  };

  const handleIncrement = () => {
    updateQty(selectedVariant.id, roundToStep(qty + step, step));
  };

  const isPerKg    = selectedVariant.quantityPricingMode === "per_kg";
  const hasSale    = selectedVariant.comparePriceAgorot !== null;
  const hasDeal    = product.dealEnabled && product.dealQuantity != null && product.dealPriceAgorot != null;
  const discountPct = hasSale
    ? Math.round(
        ((selectedVariant.comparePriceAgorot! - selectedVariant.priceAgorot) /
          selectedVariant.comparePriceAgorot!) * 100,
      )
    : 0;

  const hasImage = !!product.imageUrl;
  const imageBg  = !hasImage
    ? {
        background: `radial-gradient(ellipse at 50% 70%, ${product.imageColor} 0%, color-mix(in srgb, ${product.imageColor} 55%, white) 100%)`,
      }
    : undefined;

  // Show at most 4 variant chips to avoid overflow in the compact card
  const visibleVariants = product.variants.slice(0, 4);

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 px-3 py-2.5",
        "border-b border-stone-50 last:border-b-0",
        "transition-colors duration-100",
        isInCart ? "bg-brand-50/40" : "hover:bg-stone-50/80",
      )}
    >
      {/* ── Product image ───────────────────────────────────────────────── */}
      <div
        ref={imageRef}
        style={imageBg}
        data-fly-color={product.imageColor}
        data-fly-icon={product.icon}
        className="relative h-[52px] w-[52px] shrink-0 rounded-xl overflow-hidden bg-stone-100"
      >
        {hasImage ? (
          <Image
            loader={supabaseImageLoader}
            src={product.imageUrl!}
            alt={product.name}
            fill
            sizes="52px"
            className="object-contain"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl leading-none select-none" aria-hidden="true">
              {product.icon}
            </span>
          </div>
        )}

        {/* Sale badge */}
        {hasSale && (
          <div className="absolute top-0.5 end-0.5 bg-red-500 rounded px-1 py-[2px]">
            <span className="text-[9px] font-black text-white leading-none">
              -{discountPct}%
            </span>
          </div>
        )}

        {/* Deal badge */}
        {hasDeal && !hasSale && (
          <div className="absolute top-0.5 end-0.5 bg-orange-500 rounded px-1 py-[2px]">
            <span className="text-[9px] font-black text-white leading-none whitespace-nowrap">
              {product.dealQuantity} ב-{formatPriceCompact(product.dealPriceAgorot!)}
            </span>
          </div>
        )}

        {/* In-cart quantity bubble */}
        {isInCart && (
          <span className="absolute top-0.5 start-0.5 h-[15px] min-w-[15px] px-0.5 bg-brand-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pop">
            {formatQty(qty)}
          </span>
        )}
      </div>

      {/* ── Card content ────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 overflow-hidden">

        {/* Top row: name + navigate arrow + cart control */}
        <div className="flex items-center gap-1.5">

          {/* Name + secondary navigate link */}
          <div className="flex-1 min-w-0 flex items-center gap-1 overflow-hidden">
            <p className="text-[13px] font-semibold text-gray-900 leading-tight truncate">
              {product.name}
            </p>
            {/* Subtle arrow — navigates to /products?q=name on tap */}
            <button
              type="button"
              onClick={() => onNavigate(product.name)}
              aria-label={`הצג כל התוצאות עבור ${product.name}`}
              className="shrink-0 text-stone-300 hover:text-brand-500 transition-colors touch-manipulation p-0.5"
            >
              <ArrowLeft className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>

          {/* Cart stepper or add button */}
          <div className="shrink-0">
            {qty === 0 ? (
              <button
                type="button"
                onClick={handleAdd}
                aria-label={`הוסף ${product.name} לסל`}
                className="h-[30px] w-[30px] flex items-center justify-center rounded-full bg-brand-600 text-white hover:bg-brand-700 active:scale-90 transition-all duration-150 touch-manipulation"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : (
              <div className="flex items-center gap-0.5 bg-brand-600 rounded-full p-[3px]">
                <button
                  type="button"
                  onClick={handleDecrement}
                  aria-label="הפחת כמות"
                  className="h-[24px] w-[24px] flex items-center justify-center rounded-full text-white hover:bg-brand-500 active:bg-brand-700 transition-colors touch-manipulation"
                >
                  <Minus className="h-[10px] w-[10px]" />
                </button>
                <span className="w-5 text-center text-[11px] font-bold text-white tabular-nums select-none">
                  {formatQty(qty)}
                </span>
                <button
                  type="button"
                  onClick={handleIncrement}
                  aria-label="הוסף כמות"
                  className="h-[24px] w-[24px] flex items-center justify-center rounded-full text-white hover:bg-brand-500 active:bg-brand-700 transition-colors touch-manipulation"
                >
                  <Plus className="h-[10px] w-[10px]" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Price row */}
        <div className="flex items-baseline gap-1.5 mt-[3px]">
          <span className={cn(
            "text-[13px] font-bold leading-none",
            hasSale ? "text-red-600" : "text-gray-900",
          )}>
            {formatPrice(selectedVariant.priceAgorot)}
            {isPerKg && (
              <span className="text-[11px] font-normal text-stone-400 ms-0.5">/ק&quot;ג</span>
            )}
          </span>
          {hasSale && (
            <span className="text-[11px] text-stone-400 line-through leading-none">
              {formatPrice(selectedVariant.comparePriceAgorot!)}
            </span>
          )}
          {isInCart && (isPerKg || hasDeal) && cartItem && (
            <span className="text-[11px] text-brand-600 font-medium leading-none">
              סה&quot;כ {formatPrice(calculateLineTotal(cartItem))}
            </span>
          )}
        </div>

        {/* Variant selector — only when the product has multiple options */}
        {visibleVariants.length > 1 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {visibleVariants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedVariant(v)}
                className={cn(
                  "px-2 py-[3px] rounded-full text-[11px] font-medium border transition-all touch-manipulation",
                  selectedVariant.id === v.id
                    ? "bg-brand-600 text-white border-brand-600"
                    : "bg-white text-stone-500 border-stone-200 hover:border-brand-300 hover:text-brand-700 active:bg-brand-50",
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
