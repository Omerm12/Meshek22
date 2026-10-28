"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, Power, Trash2 } from "lucide-react";
import {
  deletePromotion,
  setPromotionActive,
} from "@/app/meshek22-control/(protected)/promotions/actions";
import { hideDeletedRow } from "@/lib/admin/hide-row";

/**
 * Enable/disable and delete controls for one promotion row.
 *
 * Deletion asks for an explicit confirmation naming the promotion, because it is
 * irreversible. Historical orders are unaffected — each order stores its own
 * promotion snapshot — and the confirmation text says so.
 */
export function PromotionRowActions({
  promotionId,
  promotionName,
  isActive,
}: {
  promotionId: string;
  promotionName: string;
  isActive: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The server-rendered value is the initial state; a successful toggle
  // updates this in place instead of refreshing the router, which would
  // re-run the whole promotions list page's own query just to flip one flag.
  const [localIsActive, setLocalIsActive] = useState(isActive);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleToggle = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await setPromotionActive(promotionId, !localIsActive);
        if (!result.success) setError(result.error);
        else setLocalIsActive((prev) => !prev);
      } catch (err) {
        console.error("[PromotionRowActions] toggle failed", err);
        setError("אירעה שגיאה בלתי צפויה. נסו שוב.");
      }
    });
  };

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await deletePromotion(promotionId);
        if (!result.success) {
          setError(result.error);
          setConfirming(false);
        } else {
          setConfirming(false);
          hideDeletedRow(containerRef.current);
        }
      } catch (err) {
        console.error("[PromotionRowActions] delete failed", err);
        setError("אירעה שגיאה בלתי צפויה. נסו שוב.");
        setConfirming(false);
      }
    });
  };

  if (confirming) {
    return (
      <div ref={containerRef} className="flex flex-col gap-2 items-stretch sm:items-end">
        <p className="text-xs text-gray-600 leading-relaxed">
          למחוק את המבצע &quot;{promotionName}&quot;? הזמנות קודמות לא יושפעו.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-60 transition-colors"
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            כן, מחקו
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={isPending}
            className="h-9 px-3 rounded-lg border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-colors"
          >
            ביטול
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col items-stretch sm:items-end gap-1.5">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleToggle}
          disabled={isPending}
          aria-label={localIsActive ? `כיבוי המבצע ${promotionName}` : `הפעלת המבצע ${promotionName}`}
          title={localIsActive ? "כיבוי המבצע" : "הפעלת המבצע"}
          className={`inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60 ${
            localIsActive
              ? "border border-gray-300 text-gray-700 hover:bg-gray-50"
              : "bg-brand-600 text-white hover:bg-brand-700"
          }`}
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Power className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {localIsActive ? "כיבוי" : "הפעלה"}
        </button>

        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={isPending}
          aria-label={`מחיקת המבצע ${promotionName}`}
          title="מחיקת המבצע"
          className="h-9 w-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-60"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-600 max-w-[16rem] leading-relaxed" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
