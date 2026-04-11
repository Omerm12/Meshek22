"use client";

import Link from "next/link";
import Image from "next/image";
import supabaseImageLoader from "@/lib/utils/supabase-image-loader";
import {
  ShoppingCart,
  Minus,
  Plus,
  Trash2,
  Leaf,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";
import { Container } from "@/components/ui/Container";
import { formatPrice } from "@/lib/utils/money";
import { useCart } from "@/store/cart";

const MIN_FREE_DELIVERY = 15000; // 150 ₪ — center zone threshold

export default function CartPage() {
  const { items, updateQty, removeItem, clearCart, subtotalAgorot, totalItems } =
    useCart();

  const remainingForFree = Math.max(0, MIN_FREE_DELIVERY - subtotalAgorot);
  const progress = Math.min(100, (subtotalAgorot / MIN_FREE_DELIVERY) * 100);

  // ── Empty state ──────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <main className="flex-1" style={{ backgroundColor: "var(--color-surface)" }}>
        <Container className="py-20 sm:py-28">
          <div className="flex flex-col items-center text-center">
            <div className="h-24 w-24 rounded-full bg-brand-50 flex items-center justify-center mb-6">
              <Leaf className="h-10 w-10 text-brand-400" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              הסל שלכם ריק
            </h1>
            <p className="text-stone-500 mb-8 max-w-xs leading-relaxed">
              הוסיפו ירקות ופירות טריים ונתחיל לארוז. המשלוח יוצא מהמשק אליכם
              תוך 24 שעות.
            </p>
            <Link
              href="/category/yerakot"
              className="inline-flex items-center gap-2.5 h-12 px-8 rounded-full bg-brand-600 text-white font-semibold hover:bg-brand-700 active:bg-brand-800 transition-colors shadow-sm"
            >
              <ArrowLeft className="h-4 w-4 rotate-180" aria-hidden="true" />
              התחילו לקנות
            </Link>
          </div>
        </Container>
      </main>
    );
  }

  // ── Full cart ────────────────────────────────────────────────────────────
  return (
    <main className="flex-1" style={{ backgroundColor: "var(--color-surface)" }}>
      <Container className="py-8 lg:py-12">

        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <ShoppingCart
              className="h-6 w-6 text-brand-600"
              aria-hidden="true"
            />
            <h1 className="text-2xl font-bold text-gray-900">סל הקניות</h1>
            <span className="h-6 min-w-6 px-1.5 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center">
              {totalItems}
            </span>
          </div>
          <button
            onClick={clearCart}
            className="text-sm text-stone-400 hover:text-red-500 transition-colors cursor-pointer"
          >
            ניקוי סל
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">

          {/* ── Items list (2/3 width on desktop) ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Free delivery progress */}
            <div className="bg-brand-50 border border-brand-100 rounded-2xl p-4">
              {remainingForFree > 0 ? (
                <p className="text-sm text-brand-700 mb-2.5">
                  עוד{" "}
                  <strong className="font-bold">
                    {formatPrice(remainingForFree)}
                  </strong>{" "}
                  ותגיעו למשלוח חינם באזורי המרכז!
                </p>
              ) : (
                <p className="text-sm font-semibold text-brand-700 mb-2.5">
                  🎉 כל הכבוד! המשלוח שלכם חינם
                </p>
              )}
              <div
                className="h-2 rounded-full bg-brand-200 overflow-hidden"
                role="progressbar"
                aria-valuenow={Math.round(progress)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="התקדמות לקבלת משלוח חינם"
              >
                <div
                  className="h-full rounded-full bg-brand-500 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Item cards */}
            <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
              <ul className="divide-y divide-stone-100" role="list">
                {items.map((item) => (
                  <li
                    key={item.variantId}
                    className="flex gap-4 p-4 sm:p-5"
                  >
                    {/* Product image */}
                    <Link
                      href={`/product/${item.productId}`}
                      className="shrink-0"
                      tabIndex={-1}
                      aria-hidden="true"
                    >
                      <div
                        className="h-20 w-20 rounded-xl relative overflow-hidden hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: item.imageColor ?? "#f0fdf0" }}
                      >
                        {item.imageUrl ? (
                          <Image
                            loader={supabaseImageLoader}
                            src={item.imageUrl}
                            alt={item.productName}
                            fill
                            sizes="80px"
                            className="object-contain p-1"
                          />
                        ) : (
                          <span className="absolute inset-0 flex items-center justify-center text-3xl">
                            {item.productIcon ?? "🛒"}
                          </span>
                        )}
                      </div>
                    </Link>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link href={`/product/${item.productId}`}>
                            <p className="font-semibold text-gray-900 leading-snug hover:text-brand-700 transition-colors truncate">
                              {item.productName}
                            </p>
                          </Link>
                          <p className="text-sm text-stone-400 mt-0.5">
                            {item.variantLabel}
                          </p>
                          <p className="text-xs text-stone-400 mt-0.5">
                            {formatPrice(item.priceAgorot)} ליחידה
                          </p>
                        </div>

                        {/* Remove */}
                        <button
                          onClick={() => removeItem(item.variantId)}
                          aria-label={`הסר ${item.productName} מהסל`}
                          className="shrink-0 h-8 w-8 flex items-center justify-center rounded-full text-stone-300 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Qty + line total */}
                      <div className="flex items-center justify-between mt-3 gap-3">
                        <div className="flex items-center gap-1 bg-stone-100 rounded-xl p-1">
                          <button
                            onClick={() =>
                              updateQty(item.variantId, item.quantity - 1)
                            }
                            aria-label="הפחת כמות"
                            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-white transition-colors text-stone-600 cursor-pointer"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span
                            className="w-7 text-center text-sm font-bold text-gray-900 tabular-nums"
                            aria-label={`כמות: ${item.quantity}`}
                          >
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateQty(item.variantId, item.quantity + 1)
                            }
                            aria-label="הוסף כמות"
                            className="h-7 w-7 flex items-center justify-center rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <p className="font-bold text-gray-900 text-base">
                          {formatPrice(item.priceAgorot * item.quantity)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Continue shopping */}
            <div>
              <Link
                href="/category/yerakot"
                className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-800 transition-colors"
              >
                <ArrowLeft
                  className="h-4 w-4 rotate-180"
                  aria-hidden="true"
                />
                המשיכו בקניות
              </Link>
            </div>
          </div>

          {/* ── Order summary (1/3 width on desktop) ── */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-stone-100 p-5 lg:sticky lg:top-24">
              <h2 className="font-bold text-gray-900 text-lg mb-5">
                סיכום הזמנה
              </h2>

              {/* Line items breakdown */}
              <div className="space-y-3 text-sm mb-5">
                <div className="flex justify-between">
                  <span className="text-stone-500">
                    מוצרים ({totalItems} פריטים)
                  </span>
                  <span className="font-medium text-gray-900">
                    {formatPrice(subtotalAgorot)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">דמי משלוח</span>
                  <span className="text-stone-400 text-xs">יחושב בקופה</span>
                </div>
              </div>

              {/* Divider + Total */}
              <div className="border-t border-stone-100 pt-4 mb-5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900">סה&quot;כ</span>
                  <span className="text-2xl font-bold text-brand-700">
                    {formatPrice(subtotalAgorot)}
                  </span>
                </div>
                <p className="text-xs text-stone-400 mt-1">
                  לא כולל דמי משלוח
                </p>
              </div>

              {/* Checkout CTA */}
              <a
                href="/checkout"
                className="flex items-center justify-center gap-2.5 w-full h-13 px-6 rounded-full bg-brand-600 text-white font-bold text-base hover:bg-brand-700 active:bg-brand-800 transition-all duration-200 shadow-md shadow-brand-600/20 hover:shadow-lg"
                style={{ height: "52px" }}
              >
                <ArrowLeft className="h-4 w-4 rotate-180" aria-hidden="true" />
                המשיכו לתשלום
              </a>

              {/* Security note */}
              <div className="flex items-center justify-center gap-1.5 mt-3 text-xs text-stone-400">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                תשלום מאובטח · Bit · כרטיס אשראי
              </div>
            </div>
          </div>
        </div>
      </Container>
    </main>
  );
}
