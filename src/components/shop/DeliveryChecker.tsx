"use client";

import { useState, useRef } from "react";
import { Search, CheckCircle2, XCircle, Loader2, Truck } from "lucide-react";
import { formatPrice } from "@/lib/utils/money";
import type { DeliveryZone } from "@/lib/delivery";

interface Settlement {
  name: string;
  delivery_zone_id: string | null;
}

interface DeliveryCheckerProps {
  zones: DeliveryZone[];
  settlements: Settlement[];
}

type Result =
  | { status: "found"; zone: DeliveryZone }
  | { status: "not_found" }
  | null;

export function DeliveryChecker({ zones, settlements }: DeliveryCheckerProps) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<Result>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const zoneById = Object.fromEntries(zones.map((z) => [z.id, z]));

  const handleCheck = () => {
    const q = query.trim();
    if (!q) {
      inputRef.current?.focus();
      return;
    }

    setLoading(true);

    // Normalise both sides for comparison: lowercase + strip extra whitespace
    const normalised = q.toLowerCase().replace(/\s+/g, " ");

    const match = settlements.find(
      (s) => s.name.toLowerCase().replace(/\s+/g, " ") === normalised,
    );

    if (match && match.delivery_zone_id) {
      const zone = zoneById[match.delivery_zone_id];
      setResult(zone ? { status: "found", zone } : { status: "not_found" });
    } else {
      setResult({ status: "not_found" });
    }

    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleCheck();
  };

  const handleReset = () => {
    setQuery("");
    setResult(null);
    inputRef.current?.focus();
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-100 p-8 sm:p-12">
      {/* Heading */}
      <div className="mb-8">
        <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          בדקו האם אנו מבצעים משלוחים ליישוב שלכם
        </h3>
        <p className="text-base text-stone-500 leading-relaxed">
          הקלידו את שם היישוב כדי לבדוק זמינות משלוח ותנאי הזמנה לאזור שלכם
        </p>
      </div>

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
            placeholder="לדוגמה: פתח תקווה, ראשון לציון..."
            className="w-full h-14 bg-white border border-stone-200 rounded-xl ps-12 pe-4 text-base text-gray-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
            dir="rtl"
            aria-label="הזן שם יישוב"
          />
        </div>
        <button
          onClick={handleCheck}
          disabled={loading || !query.trim()}
          className="h-14 px-7 rounded-xl bg-brand-600 text-white font-semibold text-base hover:bg-brand-700 active:bg-brand-800 disabled:opacity-50 transition-colors flex items-center gap-2 shrink-0 cursor-pointer disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          ) : (
            "בדיקה"
          )}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="mt-6">
          {result.status === "found" ? (
            <FoundResult zone={result.zone} onReset={handleReset} />
          ) : (
            <NotFoundResult onReset={handleReset} />
          )}
        </div>
      )}
    </div>
  );
}

function FoundResult({
  zone,
  onReset,
}: {
  zone: DeliveryZone;
  onReset: () => void;
}) {
  const isFree = zone.delivery_fee_agorot === 0;

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 mt-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-emerald-100">
        <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" aria-hidden="true" />
        <div>
          <p className="text-base font-bold text-emerald-800 leading-snug">מגיעים אליכם!</p>
          <p className="text-sm text-emerald-600 mt-0.5">משלוח זמין לאזורכם עם התנאים הבאים</p>
        </div>
      </div>

      {/* Metric boxes */}
      <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-x-reverse divide-emerald-100">
        <div className="px-6 py-5 text-center">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1">
            דמי משלוח
          </p>
          <p className="text-xl font-bold text-gray-900">
            {isFree ? "חינם" : formatPrice(zone.delivery_fee_agorot)}
          </p>
        </div>

        {zone.min_order_agorot !== null && (
          <div className="px-6 py-5 text-center">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1">
              הזמנה מינימלית
            </p>
            <p className="text-xl font-bold text-gray-900">
              {formatPrice(zone.min_order_agorot)}
            </p>
          </div>
        )}

        {zone.free_delivery_threshold_agorot && (
          <div className="px-6 py-5 text-center">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1">
              משלוח חינם מ-
            </p>
            <p className="text-xl font-bold text-emerald-600">
              {formatPrice(zone.free_delivery_threshold_agorot)}
            </p>
          </div>
        )}
      </div>

      {/* Footer action */}
      <div className="px-6 py-4 border-t border-emerald-100 flex justify-end">
        <button
          onClick={onReset}
          className="text-sm font-medium text-emerald-700 hover:text-emerald-900 transition-colors"
        >
          בדיקה ליישוב אחר ←
        </button>
      </div>
    </div>
  );
}

function NotFoundResult({ onReset }: { onReset: () => void }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
      <div className="flex items-start gap-3">
        <XCircle
          className="h-5 w-5 text-stone-400 shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 mb-0.5">
            כרגע איננו מבצעים משלוחים ליישוב שלכם
          </p>
          <p className="text-sm text-stone-500 mb-3">
            אנחנו מרחיבים את אזורי המשלוח באופן שוטף. צרו איתנו קשר ונעדכן אתכם ברגע שנגיע לאזורכם.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <a
              href="tel:0508863030"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800 transition-colors"
            >
              <Truck className="h-3.5 w-3.5" aria-hidden="true" />
              דברו איתנו: 050-8863030
            </a>
            <button
              onClick={onReset}
              className="text-xs text-stone-500 hover:text-stone-700 underline underline-offset-2 transition-colors"
            >
              ניסיון עם יישוב אחר
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
