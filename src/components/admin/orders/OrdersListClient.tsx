"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, ClipboardList } from "lucide-react";
import { fetchOrdersPage, type OrderRow, type OrderPageFilters } from "@/app/admin/orders/actions";
import { ORDER_STATUS_MAP, PAYMENT_STATUS_MAP } from "@/lib/utils/order-status";
import { StatusBadge } from "./StatusBadge";

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

  const loadMore = () => {
    if (!nextCursor || isPending) return;
    startTransition(async () => {
      const result = await fetchOrdersPage(nextCursor, filters);
      setOrders((prev) => [...prev, ...result.orders]);
      setNextCursor(result.nextCursor);
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
                <th className="text-right px-5 py-3 font-medium text-gray-500">סטטוס</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500 hidden lg:table-cell">תאריך</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((order) => {
                const customer = order.customer_snapshot as { name?: string; phone?: string } | null;
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
                      <StatusBadge map={PAYMENT_STATUS_MAP} value={order.payment_status} />
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge map={ORDER_STATUS_MAP} value={order.order_status} />
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs hidden lg:table-cell whitespace-nowrap">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/admin/orders/${order.id}`}
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
        <div className="flex justify-center">
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
        </div>
      )}
    </div>
  );
}
