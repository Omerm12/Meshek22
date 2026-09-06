"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Info, Loader2 } from "lucide-react";
import { applyOrderTransition } from "@/app/meshek22-control/(protected)/orders/actions";
import {
  getAvailableActions,
  getStatusNote,
  type AvailableAction,
  type TransitionAction,
} from "@/lib/admin/order-transitions";
import type { OrderPresentationContext } from "@/lib/admin/order-presentation";

/**
 * The order workflow, as buttons.
 *
 * Only the action that makes sense right now is offered, so there is no way to
 * pick an invalid combination of order and payment status. The server re-derives
 * the same decision, so hiding a button is convenience, not the control.
 */
export function OrderActions({
  orderId,
  context,
}: {
  orderId: string;
  context: OrderPresentationContext;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<AvailableAction | null>(null);

  const actions = getAvailableActions(context);
  const note = getStatusNote(context);

  const run = (action: TransitionAction, cashReceived: boolean) => {
    setError(null);
    setPendingConfirm(null);
    startTransition(async () => {
      try {
        const result = await applyOrderTransition(orderId, action, { cashReceived });
        if (result.success) router.refresh();
        else setError(result.error);
      } catch (err) {
        console.error("[OrderActions] transition failed", err);
        setError("אירעה שגיאה בלתי צפויה. נסו שוב.");
      }
    });
  };

  const onClick = (action: AvailableAction) => {
    // Cancellation and cash collection both get an explicit confirmation step.
    if (action.confirmMessage) setPendingConfirm(action);
    else run(action.action, false);
  };

  if (actions.length === 0 && !note) {
    return (
      <p className="text-sm text-gray-500">
        אין פעולות זמינות להזמנה זו.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {note && (
        <div className="flex items-start gap-2 rounded-xl bg-sky-50 border border-sky-200 px-3.5 py-3 text-sm text-sky-800">
          <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{note.message}</span>
        </div>
      )}

      {pendingConfirm ? (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 space-y-3"
          role="alertdialog"
          aria-label="אישור פעולה"
        >
          <p className="text-sm text-amber-900">{pendingConfirm.confirmMessage}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => run(pendingConfirm.action, pendingConfirm.requiresCashConfirmation)}
              disabled={isPending}
              className={`inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-60 ${
                pendingConfirm.tone === "danger"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-brand-600 hover:bg-brand-700"
              }`}
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              אישור
            </button>
            <button
              type="button"
              onClick={() => setPendingConfirm(null)}
              disabled={isPending}
              className="inline-flex items-center justify-center h-11 px-5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              ביטול
            </button>
          </div>
        </div>
      ) : (
        actions.length > 0 && (
          <div className="flex flex-col sm:flex-row flex-wrap gap-2">
            {actions.map((action) => (
              <button
                key={action.action}
                type="button"
                onClick={() => onClick(action)}
                disabled={isPending}
                className={`inline-flex items-center justify-center gap-2 h-12 px-5 rounded-xl text-sm font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                  action.tone === "danger"
                    ? "border border-red-300 text-red-700 hover:bg-red-50 focus-visible:ring-red-500 sm:ms-auto"
                    : "bg-brand-600 text-white hover:bg-brand-700 shadow-sm focus-visible:ring-brand-500"
                }`}
              >
                {isPending && action.tone === "primary" && (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                )}
                {action.label}
              </button>
            ))}
          </div>
        )
      )}

      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-3.5 py-3 text-sm text-red-700"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {!error && !isPending && !pendingConfirm && actions.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-gray-400">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          הפעולה תעדכן את ההזמנה מיד ותודיע ללקוח בהתאם להגדרות.
        </p>
      )}
    </div>
  );
}
