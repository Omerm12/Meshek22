"use client";

/**
 * DeliveryGateModal
 *
 * Opens before the first add-to-cart for logged-out visitors.
 * Checks whether delivery reaches the visitor's settlement using the same
 * data source and matching logic as the Delivery Areas page.
 *
 * Flow:
 *   1. User types their settlement name and clicks "בדיקה"
 *   2a. Found → show zone details + "המשך לקנייה" button
 *   2b. Not found → show error, allow retry
 *   3. On "המשך לקנייה": confirmAndAdd(cart.addItem) → item added, gate closed
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Search, CheckCircle2, XCircle, Loader2, Truck } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatPrice } from "@/lib/utils/money";
import { useCart } from "@/store/cart";
import { useDeliveryGate } from "@/store/delivery-gate";
import { fetchDeliveryGateData } from "@/app/actions/delivery";
import type { DeliveryGateData } from "@/app/actions/delivery";
import type { DeliveryZone } from "@/lib/delivery";

// ─── Delivery check result type ───────────────────────────────────────────────

type CheckResult =
  | { status: "found"; zone: DeliveryZone }
  | { status: "not_found" }
  | null;

// ─── Matching helper — identical to DeliveryChecker ──────────────────────────

function findSettlement(
  query: string,
  data: DeliveryGateData
): CheckResult {
  const normalised = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalised) return null;

  const zoneById = Object.fromEntries(data.zones.map((z) => [z.id, z]));
  const match = data.settlements.find(
    (s) => s.name.toLowerCase().replace(/\s+/g, " ") === normalised
  );

  if (match && match.delivery_zone_id) {
    const zone = zoneById[match.delivery_zone_id];
    return zone ? { status: "found", zone } : { status: "not_found" };
  }
  return { status: "not_found" };
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function DeliveryGateModal() {
  const { isOpen, closeGate, confirmAndAdd } = useDeliveryGate();
  const { addItem } = useCart();

  const [deliveryData, setDeliveryData] = useState<DeliveryGateData | null>(null);
  const [dataLoading, setDataLoading]   = useState(false);

  const [query, setQuery]     = useState("");
  const [result, setResult]   = useState<CheckResult>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Fetch delivery data once on first open ─────────────────────────────────
  useEffect(() => {
    if (!isOpen || deliveryData) return;
    let ignore = false;
    setDataLoading(true);
    fetchDeliveryGateData()
      .then((data) => { if (!ignore) { setDeliveryData(data); setDataLoading(false); } })
      .catch(() => { if (!ignore) setDataLoading(false); });
    return () => { ignore = true; };
  }, [isOpen, deliveryData]);

  // ── Focus input when modal opens ───────────────────────────────────────────
  useEffect(() => {
    if (isOpen && !dataLoading) {
      // Small delay so the modal is painted before focusing
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [isOpen, dataLoading]);

  // ── Reset local UI state each time modal opens ─────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResult(null);
    }
  }, [isOpen]);

  // ── Keyboard: Escape → close ───────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeGate(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, closeGate]);

  // ── Body scroll lock ───────────────────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // ── Check handler ──────────────────────────────────────────────────────────
  const handleCheck = useCallback(() => {
    if (!deliveryData || !query.trim()) {
      inputRef.current?.focus();
      return;
    }
    setResult(findSettlement(query, deliveryData));
  }, [query, deliveryData]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleCheck();
  };

  // ── Confirm and add pending item ───────────────────────────────────────────
  const handleConfirm = useCallback(() => {
    confirmAndAdd(addItem);
  }, [confirmAndAdd, addItem]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={closeGate}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="בדיקת אזור משלוח"
        className={cn(
          "fixed z-50 inset-x-4 top-1/2 -translate-y-1/2 mx-auto",
          "w-full max-w-[600px] bg-white rounded-2xl shadow-2xl",
          "flex flex-col overflow-hidden"
        )}
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between px-8 pt-8 pb-6 border-b border-stone-100">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-brand-50 flex items-center justify-center shrink-0 mt-0.5">
              <Truck className="h-6 w-6 text-brand-600" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 leading-snug">
                לפני שנתחיל, נבדוק אם המשלוחים מגיעים אליכם
              </h2>
            </div>
          </div>
          <button
            onClick={closeGate}
            aria-label="סגור"
            className="h-9 w-9 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer shrink-0 ms-3 mt-0.5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="px-8 py-7">
          <p className="text-base text-stone-500 leading-relaxed mb-1.5">
            אנחנו רוצים לוודא שאפשר לספק משלוח לאזורכם לפני תחילת הקנייה.
          </p>
          <p className="text-sm font-semibold text-gray-700 leading-relaxed mb-6">
            יש להזין את שם היישוב בלבד — לא כתובת מלאה.
          </p>

          {/* Input row */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search
                className="absolute top-1/2 -translate-y-1/2 start-4 h-5 w-5 text-stone-400 pointer-events-none"
                aria-hidden="true"
              />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (result) setResult(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder="לדוגמה: פתח תקווה, רחובות, ראשון לציון"
                disabled={dataLoading}
                dir="rtl"
                aria-label="שם היישוב"
                className={cn(
                  "w-full h-14 bg-white border border-stone-200 rounded-xl ps-12 pe-4",
                  "text-base text-gray-900 placeholder:text-stone-400",
                  "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent",
                  "disabled:opacity-50 transition-shadow"
                )}
              />
            </div>
            <button
              onClick={handleCheck}
              disabled={dataLoading || !query.trim()}
              className={cn(
                "h-14 px-7 rounded-xl bg-brand-600 text-white font-semibold text-base",
                "hover:bg-brand-700 active:bg-brand-800",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-colors flex items-center gap-2 shrink-0 cursor-pointer"
              )}
            >
              {dataLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                "בדיקה"
              )}
            </button>
          </div>

          {/* Result area */}
          {result && (
            <div className="mt-5">
              {result.status === "found" ? (
                <FoundResult zone={result.zone} onConfirm={handleConfirm} />
              ) : (
                <NotFoundResult onRetry={() => { setResult(null); setQuery(""); inputRef.current?.focus(); }} />
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Found result ─────────────────────────────────────────────────────────────

function FoundResult({
  zone,
  onConfirm,
}: {
  zone: DeliveryZone;
  onConfirm: () => void;
}) {
  const isFree = zone.delivery_fee_agorot === 0;

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
      {/* Status line */}
      <div className="flex items-center gap-3 mb-4">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-bold text-emerald-800 text-sm leading-snug">
            מגיעים אליכם!
          </p>
          <p className="text-xs text-emerald-700 mt-0.5">
            משלוח זמין לאזורכם עם התנאים הבאים:
          </p>
        </div>
      </div>

      {/* Metric pills */}
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="bg-white rounded-lg px-3 py-2 border border-emerald-100 text-center min-w-[90px]">
          <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-0.5">
            דמי משלוח
          </p>
          <p className="text-base font-bold text-gray-900">
            {isFree ? "חינם" : formatPrice(zone.delivery_fee_agorot)}
          </p>
        </div>
        {zone.min_order_agorot !== null && (
          <div className="bg-white rounded-lg px-3 py-2 border border-emerald-100 text-center min-w-[90px]">
            <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-0.5">
              מינימום הזמנה
            </p>
            <p className="text-base font-bold text-gray-900">
              {formatPrice(zone.min_order_agorot)}
            </p>
          </div>
        )}
        {zone.free_delivery_threshold_agorot && (
          <div className="bg-white rounded-lg px-3 py-2 border border-emerald-100 text-center min-w-[90px]">
            <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-0.5">
              משלוח חינם מ-
            </p>
            <p className="text-base font-bold text-emerald-600">
              {formatPrice(zone.free_delivery_threshold_agorot)}
            </p>
          </div>
        )}
      </div>

      {/* Confirm CTA */}
      <button
        onClick={onConfirm}
        className={cn(
          "w-full h-13 py-3.5 rounded-xl bg-brand-600 text-white font-semibold text-base",
          "hover:bg-brand-700 active:bg-brand-800 transition-colors cursor-pointer"
        )}
      >
        המשך לקנייה
      </button>
    </div>
  );
}

// ─── Not-found result ─────────────────────────────────────────────────────────

function NotFoundResult({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
      <div className="flex items-start gap-3">
        <XCircle className="h-5 w-5 text-stone-400 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm mb-0.5">
            כרגע איננו מבצעים משלוחים ליישוב שלכם
          </p>
          <p className="text-xs text-stone-500 mb-3 leading-relaxed">
            אנחנו מרחיבים את אזורי המשלוח באופן שוטף. צרו איתנו קשר ונעדכן אתכם ברגע שנגיע לאזורכם.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <a
              href="tel:0508863030"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-800 transition-colors"
            >
              <Truck className="h-3.5 w-3.5" aria-hidden="true" />
              דברו איתנו: 050-8863030
            </a>
            <button
              onClick={onRetry}
              className="text-xs text-stone-500 hover:text-stone-700 underline underline-offset-2 transition-colors cursor-pointer"
            >
              ניסיון עם יישוב אחר
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
