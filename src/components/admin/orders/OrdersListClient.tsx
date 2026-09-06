"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertCircle, ExternalLink, Loader2, ClipboardList, Store, Truck } from "lucide-react";
import { fetchOrdersPage, type OrderRow, type OrderPageFilters } from "@/app/meshek22-control/(protected)/orders/actions";
import {
  describeOrderStatus,
  describePaymentState,
  isPickupOrder,
} from "@/lib/admin/order-presentation";
import { ADMIN_BASE_PATH } from "@/lib/admin/routes";

function formatPrice(agorot: number) {
  return `₪${(agorot / 100).toLocaleString("he-IL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("he-IL", {
    day:    "numeric",
    month:  "short",
    year:   "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  });
}

interface OrdersListClientProps {
  initialOrders:    OrderRow[];
  initialNextCursor: string | null;
  filters:          OrderPageFilters;
  hasActiveFilters: boolean;
}

export function OrdersListClient({
  initialOrders,
  initialNextCursor,
  filters,
  hasActiveFilters,
}: OrdersListClientProps) {
  const [orders,     setOrders]     = useState<OrderRow[]>(initialOrders);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [isPending,  startTransition] = useTransition();
  const [error,      setError]      = useState<string | null>(null);

  const loadMore = () => {
    if (!nextCursor || isPending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await fetchOrdersPage(nextCursor, filters);
        if (result.failed) {
          setError("שגיאה בטעינת הזמנות נוספות. נסו שוב.");
          return;
        }
        setOrders((prev) => [...prev, ...result.orders]);
        setNextCursor(result.nextCursor);
      } catch (err) {
        console.error("[OrdersListClient] loadMore failed", err);
        setError("אירעה שגיאה בלתי צפויה. נסו שוב.");
      }
    });
  };

  if (orders.length === 0 && !hasActiveFilters) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
        <div className="h-14 w-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ClipboardList className="h-7 w-7 text-gray-300" aria-hidden="true" />
        </div>
        <p className="text-sm font-semibold text-gray-900">אין הזמנות עדיין</p>
        <p className="text-sm text-gray-400 mt-1">
          הזמנות יופיעו כאן לאחר שלקוחות יבצעו רכישות
        </p>
      </div>
    );
  }

  if (orders.length === 0 && hasActiveFilters) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
        <p className="text-sm font-semibold text-gray-900">לא נמצאו תוצאות</p>
        <p className="text-sm text-gray-400 mt-1">
          נסו לשנות את הפילטרים או לנקות את החיפוש
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" dir="rtl">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-right px-5 py-3 font-medium text-gray-500">מספר</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500">לקוח</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500 hidden md:table-cell">טלפון</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500">סה&quot;כ</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500 hidden sm:table-cell">תשלום</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500 hidden lg:table-cell">אופן קבלה</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500">סטטוס</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500 hidden lg:table-cell">תאריך</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((order) => {
                const customer = order.customer_snapshot as { name?: string; phone?: string } | null;
                const ctx = {
                  orderStatus: order.order_status,
                  paymentStatus: order.payment_status,
                  paymentMethod: order.payment_method,
                  fulfillmentMethod: order.fulfillment_method,
                };
                const status = describeOrderStatus(ctx);
                const payment = describePaymentState(ctx);
                const pickup = isPickupOrder(ctx);
                return (
                  <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs text-gray-600">{order.order_number}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-medium text-gray-900">{customer?.name ?? "—"}</span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 hidden md:table-cell" dir="ltr">
                      {customer?.phone ?? "—"}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-gray-900 tabular-nums" dir="ltr">
                      {formatPrice(order.total_agorot)}
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      {/* Payment wording already reflects the method, e.g.
                          "מזומן בעת המסירה" — no separate method column needed. */}
                      <span className={`inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold border whitespace-nowrap ${payment.cls}`}>
                        {payment.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${
                          pickup ? "bg-amber-50 text-amber-700" : "bg-sky-50 text-sky-700"
                        }`}
                      >
                        {pickup ? (
                          <Store className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <Truck className="h-3 w-3" aria-hidden="true" />
                        )}
                        {pickup ? "איסוף עצמי" : "משלוח"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold border whitespace-nowrap ${status.cls}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs hidden lg:table-cell whitespace-nowrap">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="px-5 py-3.5">
                      <Link
                        href={`${ADMIN_BASE_PATH}/orders/${order.id}`}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-brand-600 hover:bg-brand-50 border border-transparent hover:border-brand-200 transition-colors whitespace-nowrap"
                        aria-label={`צפה בהזמנה ${order.order_number}`}
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        צפייה
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Load more */}
      {nextCursor && (
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={loadMore}
            disabled={isPending}
            className="inline-flex items-center gap-2 h-10 px-6 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-60 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            {isPending ? "טוען..." : "טען עוד הזמנות"}
          </button>
          {error && (
            <p role="alert" className="flex items-center gap-1.5 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
