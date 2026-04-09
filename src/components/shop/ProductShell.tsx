"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import supabaseImageLoader from "@/lib/utils/supabase-image-loader";
import {
  ShoppingCart,
  Plus,
  Minus,
  CheckCircle2,
  ChevronLeft,
} from "lucide-react";
import { Container } from "@/components/ui/Container";
import { ProductCard } from "@/components/shop/ProductCard";
import { useCart } from "@/store/cart";
import { formatPrice } from "@/lib/utils/money";
import type { MockProduct, MockVariant } from "@/lib/data/mock";

interface ProductShellProps {
  product: MockProduct;
  relatedProducts: MockProduct[];
}

export function ProductShell({ product, relatedProducts }: ProductShellProps) {
  const { addItem, openCart } = useCart();

  const defaultVariant =
    product.variants.find((v) => v.isDefault) ?? product.variants[0];
  const [selectedVariant, setSelectedVariant] =
    useState<MockVariant>(defaultVariant);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const hasSale = selectedVariant.comparePriceAgorot !== null;
  const discountPct = hasSale
    ? Math.round(
        ((selectedVariant.comparePriceAgorot! - selectedVariant.priceAgorot) /
          selectedVariant.comparePriceAgorot!) *
          100
      )
    : 0;

  const handleAddToCart = useCallback(() => {
    addItem({
      variantId: selectedVariant.id,
      productId: product.id,
      productName: product.name,
      variantLabel: selectedVariant.label,
      priceAgorot: selectedVariant.priceAgorot,
      imageColor: product.imageColor,
      productIcon: product.icon,
      quantity: qty,
    });
    setAdded(true);
    openCart();
    const t = setTimeout(() => setAdded(false), 2500);
    return () => clearTimeout(t);
  }, [addItem, openCart, selectedVariant, product, qty]);

  const lineTotal = selectedVariant.priceAgorot * qty;

  return (
    <div className="flex-1">
      {/* ── Breadcrumb ── */}
      <div className="bg-white border-b border-stone-100">
        <Container className="py-3">
          <nav
            className="flex items-center gap-1.5 text-sm text-stone-400"
            aria-label="breadcrumb"
          >
            <Link href="/" className="hover:text-brand-700 transition-colors">
              דף הבית
            </Link>
            <span aria-hidden="true">/</span>
            <Link
              href={`/category/${product.categorySlug}`}
              className="hover:text-brand-700 transition-colors"
            >
              {product.categoryName}
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-gray-700 font-medium truncate max-w-[200px]">
              {product.name}
            </span>
          </nav>
        </Container>
      </div>

      {/* ── Main product section ── */}
      <Container className="py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-start">

          {/* ── Image column ── */}
          <div className="lg:sticky lg:top-24">
            <div
              className="aspect-square max-w-sm mx-auto lg:max-w-full rounded-3xl overflow-hidden relative"
              style={{
                background: product.imageUrl
                  ? undefined
                  : `radial-gradient(ellipse at 45% 42%, ${product.imageColor} 0%, color-mix(in srgb, ${product.imageColor} 40%, white) 100%)`,
                boxShadow: "0 24px 64px -12px rgba(0,0,0,0.09)",
              }}
            >
              {product.imageUrl ? (
                <Image
                  loader={supabaseImageLoader}
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  sizes="(max-width: 1024px) 384px, 50vw"
                  className="object-contain p-6"
                  priority
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span
                    className="select-none drop-shadow-sm leading-none"
                    style={{ fontSize: "clamp(7rem, 18vw, 12rem)" }}
                    aria-hidden="true"
                  >
                    {product.icon}
                  </span>
                </div>
              )}
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-2 justify-center mt-5">
              {["נקטף טרי", "משלוח עד 24 שעות", "100% החזר כספי"].map(
                (badge) => (
                  <span
                    key={badge}
                    className="flex items-center gap-1.5 text-xs text-stone-500 bg-white border border-stone-100 rounded-full px-3 py-1.5"
                  >
                    <CheckCircle2
                      className="h-3 w-3 text-brand-500 shrink-0"
                      aria-hidden="true"
                    />
                    {badge}
                  </span>
                )
              )}
            </div>
          </div>

          {/* ── Info column ── */}
          <div>
            {/* Category link */}
            <Link
              href={`/category/${product.categorySlug}`}
              className="text-xs font-bold text-brand-600 uppercase tracking-widest hover:text-brand-800 transition-colors"
            >
              {product.categoryName}
            </Link>

            {/* Name */}
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-2 mb-3 leading-tight">
              {product.name}
            </h1>

            {/* Short description */}
            <p className="text-stone-500 text-base leading-relaxed mb-6">
              {product.description}
            </p>

            {/* Price */}
            <div className="flex items-baseline gap-3 mb-7">
              <span className="text-[2.6rem] font-bold text-gray-900 leading-none tracking-tight">
                {formatPrice(selectedVariant.priceAgorot)}
              </span>
              {hasSale && (
                <>
                  <span className="text-lg text-stone-400 line-through leading-none">
                    {formatPrice(selectedVariant.comparePriceAgorot!)}
                  </span>
                  <span className="text-sm font-bold text-white bg-red-500 rounded-full px-2.5 py-0.5 leading-none">
                    -{discountPct}%
                  </span>
                </>
              )}
            </div>

            {/* Variant selector */}
            {product.variants.length > 1 && (
              <div className="mb-7">
                <p className="text-sm font-semibold text-gray-700 mb-3">
                  בחרו כמות / גודל
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => {
                        setSelectedVariant(v);
                        setQty(1);
                      }}
                      className={[
                        "relative px-5 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-150 cursor-pointer",
                        selectedVariant.id === v.id
                          ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                          : "bg-white text-stone-600 border-stone-200 hover:border-brand-400 hover:text-brand-700",
                      ].join(" ")}
                    >
                      {v.label}
                      {v.comparePriceAgorot && (
                        <span
                          className={[
                            "absolute -top-1.5 -end-1.5 text-[9px] font-bold px-1 rounded-full",
                            selectedVariant.id === v.id
                              ? "bg-white text-brand-700"
                              : "bg-red-500 text-white",
                          ].join(" ")}
                        >
                          חיסכון
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Qty stepper + Add to cart */}
            <div className="flex items-stretch gap-3 mb-4">
              {/* Quantity stepper */}
              <div className="flex items-center bg-stone-100 rounded-xl p-1 gap-0.5">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  aria-label="הפחת כמות"
                  disabled={qty <= 1}
                  className="h-10 w-10 flex items-center justify-center rounded-lg hover:bg-white transition-colors text-stone-600 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span
                  className="w-10 text-center text-base font-bold text-gray-900 tabular-nums"
                  aria-live="polite"
                  aria-label={`כמות: ${qty}`}
                >
                  {qty}
                </span>
                <button
                  onClick={() => setQty((q) => Math.min(99, q + 1))}
                  aria-label="הוסף כמות"
                  className="h-10 w-10 flex items-center justify-center rounded-lg hover:bg-white transition-colors text-stone-600 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {/* Add to cart */}
              <button
                onClick={handleAddToCart}
                aria-label={`הוסף ${product.name} לסל`}
                className={[
                  "flex-1 flex items-center justify-center gap-2.5 h-[52px] rounded-xl font-bold text-base cursor-pointer transition-all duration-200",
                  "focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
                  added
                    ? "bg-green-500 text-white shadow-md shadow-green-500/20"
                    : "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-md shadow-brand-600/20 hover:shadow-lg",
                ].join(" ")}
              >
                {added ? (
                  <>
                    <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                    נוסף לסל!
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-5 w-5" aria-hidden="true" />
                    {qty > 1 ? `הוסיפו ${qty} לסל` : "הוסיפו לסל"}
                  </>
                )}
              </button>
            </div>

            {/* Running total */}
            {qty > 1 && (
              <p className="text-sm text-stone-400 mb-4">
                סה&quot;כ:{" "}
                <strong className="text-gray-700">{formatPrice(lineTotal)}</strong>
              </p>
            )}

            {/* Long description */}
            {product.longDescription && (
              <div className="mt-7 pt-6 border-t border-stone-100">
                <h2 className="font-bold text-gray-900 text-base mb-3">
                  אודות המוצר
                </h2>
                <p className="text-stone-500 leading-relaxed text-sm">
                  {product.longDescription}
                </p>
              </div>
            )}
          </div>
        </div>
      </Container>

      {/* ── Related products ── */}
      {relatedProducts.length > 0 && (
        <section
          className="border-t border-stone-100 py-10 lg:py-14"
          style={{ backgroundColor: "var(--color-surface-2)" }}
          aria-label="מוצרים נוספים"
        >
          <Container>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                עוד מ{product.categoryName}
              </h2>
              <Link
                href={`/category/${product.categorySlug}`}
                className="text-sm font-medium text-brand-700 hover:text-brand-800 transition-colors flex items-center gap-1"
              >
                לכל הקטגוריה
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </Container>
        </section>
      )}
    </div>
  );
}
