"use client";

import { useState, useTransition } from "react";
import { Loader2, CheckCircle2, AlertCircle, Save } from "lucide-react";
import { updateOrderStatuses } from "@/app/admin/orders/actions";
import { ORDER_STATUS_OPTIONS, PAYMENT_STATUS_OPTIONS } from "@/lib/utils/order-status";

const selectCls =
  "w-full h-10 bg-white border border-gray-200 rounded-xl px-3 text-sm text-gray-900 " +
  "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow " +
  "appearance-none cursor-pointer";

interface OrderStatusSelectProps {
  orderId:       string;
  orderStatus:   string;
  paymentStatus: string;
}

export function OrderStatusSelect({
  orderId,
  orderStatus,
  paymentStatus,
}: OrderStatusSelectProps) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFeedback(null);
    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await updateOrderStatuses(orderId, fd);
      setFeedback(
        result.success
          ? { ok: true,  msg: "הסטטוס עודכן בהצלחה" }
          : { ok: false, msg: result.error }
      );
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Order status */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            סטטוס הזמנה
          </label>
          <div className="relative">
            <select
              name="order_status"
              defaultValue={orderStatus}
              className={selectCls}
            >
              {ORDER_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 end-3 flex items-center">
              <svg className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>

        {/* Payment status */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            סטטוס תשלום
          </label>
          <div className="relative">
            <select
              name="payment_status"
              defaultValue={paymentStatus}
              className={selectCls}
            >
              {PAYMENT_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 end-3 flex items-center">
              <svg className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={[
            "flex items-start gap-2 text-sm rounded-xl px-3 py-2.5",
            feedback.ok
              ? "text-green-700 bg-green-50 border border-green-200"
              : "text-red-700 bg-red-50 border border-red-200",
          ].join(" ")}
        >
          {feedback.ok ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          )}
          {feedback.msg}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 disabled:opacity-60 transition-colors cursor-pointer disabled:cursor-not-allowed"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Save className="h-4 w-4" aria-hidden="true" />
        )}
        שמור שינויים
      </button>
    </form>
  );
}
