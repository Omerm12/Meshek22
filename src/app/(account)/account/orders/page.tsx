import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShoppingBag, ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils/money";
import type { Database } from "@/types/database";

export const metadata: Metadata = {
  title: "ההזמנות שלי",
};

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

const ORDER_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending_payment: { label: "ממתין לתשלום", color: "bg-amber-100 text-amber-700" },
  paid:            { label: "שולם",          color: "bg-sky-100 text-sky-700" },
  confirmed:       { label: "אושר",           color: "bg-sky-100 text-sky-700" },
  preparing:       { label: "בהכנה",          color: "bg-violet-100 text-violet-700" },
  out_for_delivery:{ label: "בדרך אליכם",     color: "bg-orange-100 text-orange-700" },
  delivered:       { label: "נמסר",           color: "bg-emerald-100 text-emerald-700" },
  cancelled:       { label: "בוטל",           color: "bg-red-100 text-red-600" },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function OrdersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const orders = (data ?? []) as OrderRow[];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">ההזמנות שלי</h1>

      {orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-100 p-12 text-center">
          <div className="h-16 w-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4">
            <ShoppingBag className="h-7 w-7 text-stone-400" aria-hidden="true" />
          </div>
          <h2 className="font-bold text-gray-900 mb-2">אין עדיין הזמנות</h2>
          <p className="text-sm text-stone-400 mb-6 max-w-xs mx-auto">
            ההזמנות שלכם יופיעו כאן לאחר שתבצעו את הרכישה הראשונה
          </p>
          <Link
            href="/vegetables"
            className="inline-flex items-center gap-2 h-9 px-5 rounded-full bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
          >
            התחילו לקנות
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const statusInfo =
              ORDER_STATUS_LABELS[order.order_status] ??
              { label: order.order_status, color: "bg-stone-100 text-stone-600" };

            const address = order.delivery_address_snapshot as
              | { city?: string; street?: string; house_number?: string }
              | null;

            return (
              <Link
                key={order.id}
                href={`/account/orders/${order.id}`}
                className="block bg-white rounded-2xl border border-stone-100 p-5 hover:border-brand-200 hover:shadow-sm transition-all duration-200 group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                      <span className="font-bold text-gray-900 font-mono tracking-wide text-sm">
                        {order.order_number}
                      </span>
                      <span
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusInfo.color}`}
                      >
                        {statusInfo.label}
                      </span>
                    </div>
                    <p className="text-xs text-stone-400">
                      {formatDate(order.created_at)}
                      {address?.city && ` · ${address.city}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-bold text-gray-900">
                      {formatPrice(order.total_agorot)}
                    </span>
                    <ChevronLeft
                      className="h-4 w-4 text-stone-300 group-hover:text-brand-500 transition-colors"
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
