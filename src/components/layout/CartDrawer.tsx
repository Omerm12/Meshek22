"use client";

import { useEffect, useRef } from "react";
import { X, ShoppingCart, Minus, Plus, Trash2, Leaf, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatPrice } from "@/lib/utils/money";
import { useCart } from "@/store/cart";
import { Button } from "@/components/ui/Button";

export function CartDrawer() {
  const { isOpen, closeCart, items, updateQty, removeItem, subtotalAgorot, totalItems } =
    useCart();

  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, closeCart]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // Delivery fee hint (simplified: show cheapest zone)
  const MIN_FREE_DELIVERY = 15000; // 150 ₪ (center-local zone)
  const remainingForFree = Math.max(0, MIN_FREE_DELIVERY - subtotalAgorot);
  const progress = Math.min(100, (subtotalAgorot / MIN_FREE_DELIVERY) * 100);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={closeCart}
        aria-hidden="true"
      />

      {/* Drawer panel — slides in from the right */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="סל הקניות"
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl",
          "transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-brand-600" aria-hidden="true" />
            <h2 className="font-bold text-gray-900 text-lg">סל הקניות</h2>
            {totalItems > 0 && (
              <span className="h-5 min-w-5 px-1.5 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </div>
          <button
            onClick={closeCart}
            aria-label="סגור סל קניות"
            className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-500 hover:text-stone-800 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Free delivery progress ── */}
        {subtotalAgorot > 0 && (
          <div className="px-5 py-3 bg-brand-50 border-b border-brand-100">
            {remainingForFree > 0 ? (
              <p className="text-xs text-brand-700 mb-1.5">
                עוד{" "}
                <strong>{formatPrice(remainingForFree)}</strong>{" "}
                ותגיעו למשלוח חינם באזורי המרכז!
              </p>
            ) : (
              <p className="text-xs text-brand-700 font-semibold mb-1.5">
                🎉 כל הכבוד! המשלוח שלכם חינם
              </p>
            )}
            <div className="h-1.5 rounded-full bg-brand-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
        )}

        {/* ── Items list ── */}
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <EmptyCart onClose={closeCart} />
          ) : (
            <ul className="divide-y divide-stone-100 px-5" role="list">
              {items.map((item) => (
                <li key={item.variantId} className="py-4 flex gap-3">
                  {/* Image placeholder */}
                  <div
                    className="h-16 w-16 rounded-xl flex items-center justify-center text-2xl shrink-0"
                    style={{ backgroundColor: item.imageColor ?? "#f0fdf0" }}
                    aria-hidden="true"
                  >
                    {item.productIcon ?? "🛒"}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 leading-snug truncate">
                      {item.productName}
                    </p>
                    <p className="text-xs text-stone-400 mt-0.5">{item.variantLabel}</p>

                    <div className="flex items-center justify-between mt-2 gap-2">
                      {/* Qty control */}
                      <div className="flex items-center gap-1 bg-stone-100 rounded-full p-0.5">
                        <button
                          onClick={() => updateQty(item.variantId, item.quantity - 1)}
                          aria-label="הפחת כמות"
                          className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-stone-200 text-stone-600 transition-colors cursor-pointer"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-5 text-center text-xs font-bold text-gray-900">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQty(item.variantId, item.quantity + 1)}
                          aria-label="הוסף כמות"
                          className="h-6 w-6 flex items-center justify-center rounded-full bg-brand-600 text-white hover:bg-brand-700 transition-colors cursor-pointer"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Line price */}
                      <span className="text-sm font-bold text-gray-900 shrink-0">
                        {formatPrice(item.priceAgorot * item.quantity)}
                      </span>
                    </div>
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => removeItem(item.variantId)}
                    aria-label={`הסר ${item.productName}`}
                    className="shrink-0 self-start mt-0.5 h-7 w-7 flex items-center justify-center rounded-full text-stone-300 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Footer / Checkout ── */}
        {items.length > 0 && (
          <div className="border-t border-stone-100 px-5 py-5 bg-white">
            {/* Subtotal row */}
            <div className="flex items-center justify-between mb-1 text-sm">
              <span className="text-stone-500">סה"כ מוצרים</span>
              <span className="font-semibold text-gray-900">{formatPrice(subtotalAgorot)}</span>
            </div>
            <div className="flex items-center justify-between mb-4 text-xs text-stone-400">
              <span>דמי משלוח יחושבו בקופה</span>
            </div>

            {/* Divider */}
            <div className="h-px bg-stone-100 mb-4" />

            {/* Total */}
            <div className="flex items-center justify-between mb-4">
              <span className="font-bold text-gray-900">סה"כ לתשלום</span>
              <span className="text-xl font-bold text-brand-700">
                {formatPrice(subtotalAgorot)}
              </span>
            </div>

            <a
              href="/checkout"
              onClick={closeCart}
              className={cn(
                "flex items-center justify-center gap-2 w-full h-12 rounded-full",
                "bg-brand-600 text-white font-bold text-base",
                "hover:bg-brand-700 active:bg-brand-800",
                "transition-all duration-200 shadow-sm hover:shadow"
              )}
            >
              <ArrowLeft className="h-4 w-4 rotate-180" aria-hidden="true" />
              המשיכו לתשלום
            </a>

            <button
              onClick={closeCart}
              className="mt-3 w-full text-center text-sm text-stone-400 hover:text-brand-700 transition-colors cursor-pointer"
            >
              המשיכו בקניות
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyCart({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-16 px-8 text-center">
      <div className="h-20 w-20 rounded-full bg-brand-50 flex items-center justify-center mb-5">
        <Leaf className="h-9 w-9 text-brand-400" aria-hidden="true" />
      </div>
      <h3 className="font-bold text-gray-900 text-lg mb-2">הסל שלכם ריק</h3>
      <p className="text-sm text-stone-400 leading-relaxed mb-6">
        הוסיפו ירקות ופירות טריים ונתחיל לארוז
      </p>
      <Button variant="primary" size="md" onClick={onClose}>
        <ShoppingCart className="h-4 w-4" />
        התחילו לקנות
      </Button>
    </div>
  );
}
