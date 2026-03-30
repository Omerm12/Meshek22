import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Package, MapPin, Phone, Mail, Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils/money";
import type { Database } from "@/types/database";

export const metadata: Metadata = { title: "פרטי הזמנה" };

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];

const STATUS: Record<string, { label: string; color: string; step: number }> = {
  pending_payment: { label: "ממתין לתשלום", color: "bg-amber-100 text-amber-700",   step: 0 },
  paid:            { label: "שולם",          color: "bg-sky-100 text-sky-700",       step: 1 },
  confirmed:       { label: "אושר",           color: "bg-sky-100 text-sky-700",       step: 1 },
  preparing:       { label: "בהכנה",          color: "bg-violet-100 text-violet-700", step: 2 },
  out_for_delivery:{ label: "בדרך אליכם",     color: "bg-orange-100 text-orange-700", step: 3 },
  delivered:       { label: "נמסר",           color: "bg-emerald-100 text-emerald-700",step: 4 },
  cancelled:       { label: "בוטל",           color: "bg-red-100 text-red-600",       step: -1 },
};

const STEPS = ["הזמנה התקבלה", "אושרה ושולמה", "בהכנה", "בדרך", "נמסרה"];

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("he-IL", {
    day: "numeric", month: "long", year: "numeric",
  });
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [orderRes, itemsRes] = await Promise.all([
    supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("order_items")
      .select("*")
      .eq("order_id", id),
  ]);

  if (orderRes.error || !orderRes.data) notFound();

  const order = orderRes.data as OrderRow;
  const items = (itemsRes.data ?? []) as OrderItemRow[];

  const statusInfo = STATUS[order.order_status] ?? {
    label: order.order_status,
    color: "bg-stone-100 text-stone-600",
    step: 0,
  };

  const customer = order.customer_snapshot as
    | { name?: string; email?: string; phone?: string } | null;
  const address = order.delivery_address_snapshot as
    | { street?: string; house_number?: string; apartment?: string; city?: string; zone_name?: string } | null;

  const isCancelled = order.order_status === "cancelled";

  return (
    <div>
      {/* Back */}
      <Link
        href="/account/orders"
        className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-brand-700 transition-colors mb-5"
      >
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
        חזרה להזמנות
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            הזמנה {order.order_number}
          </h1>
          <p className="text-sm text-stone-400">{formatDate(order.created_at)}</p>
        </div>
        <span className={`text-sm font-semibold px-3 py-1.5 rounded-full ${statusInfo.color}`}>
          {statusInfo.label}
        </span>
      </div>

      {/* Progress tracker */}
      {!isCancelled && (
        <div className="bg-white rounded-2xl border border-stone-100 p-5 mb-4">
          <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1">
            {STEPS.map((step, i) => {
              const done = i <= statusInfo.step;
              const active = i === statusInfo.step;
              return (
                <div key={step} className="flex flex-col items-center gap-1.5 min-w-0 flex-1">
                  <div
                    className={`h-7 w-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                      done
                        ? "border-brand-500 bg-brand-500 text-white"
                        : "border-stone-200 bg-white text-stone-300"
                    } ${active ? "ring-2 ring-brand-200" : ""}`}
                  >
                    {done ? "✓" : i + 1}
                  </div>
                  <p className={`text-[10px] text-center leading-tight ${done ? "text-brand-700 font-semibold" : "text-stone-400"}`}>
                    {step}
                  </p>
                  {i < STEPS.length - 1 && (
                    <div className="absolute" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Items */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-stone-100">
              <Package className="h-4 w-4 text-brand-600" />
              <h2 className="font-bold text-gray-900">פריטים</h2>
            </div>
            <ul className="divide-y divide-stone-100">
              {items.map((item) => {
                const snap = item.product_snapshot as
                  | { product_name?: string; variant_label?: string } | null;
                return (
                  <li key={item.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="h-10 w-10 rounded-lg bg-brand-50 flex items-center justify-center text-xl shrink-0">
                      🥬
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {snap?.product_name ?? "מוצר"}
                      </p>
                      <p className="text-xs text-stone-400">
                        {snap?.variant_label ?? ""} · כמות: {item.quantity}
                      </p>
                    </div>
                    <div className="text-end shrink-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {formatPrice(item.total_price_agorot)}
                      </p>
                      <p className="text-xs text-stone-400">
                        {formatPrice(item.unit_price_agorot)} ליח׳
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Delivery address */}
          {address && (
            <div className="bg-white rounded-2xl border border-stone-100 p-5">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="h-4 w-4 text-brand-600" />
                <h2 className="font-bold text-gray-900">כתובת משלוח</h2>
              </div>
              <p className="text-sm text-gray-900">
                {address.street} {address.house_number}
                {address.apartment ? `, ${address.apartment}` : ""}
              </p>
              <p className="text-sm text-stone-500">{address.city}</p>
              {address.zone_name && (
                <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-brand-700 bg-brand-50 border border-brand-100 rounded-full px-2.5 py-1">
                  <Truck className="h-3 w-3" />
                  {address.zone_name}
                </div>
              )}
              {order.delivery_notes && (
                <p className="mt-2 text-xs text-stone-500 italic">
                  הערה: {order.delivery_notes}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Summary sidebar */}
        <div className="space-y-4">
          {/* Price breakdown */}
          <div className="bg-white rounded-2xl border border-stone-100 p-5">
            <h2 className="font-bold text-gray-900 mb-3">סיכום תשלום</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-stone-600">
                <span>מוצרים</span>
                <span>{formatPrice(order.subtotal_agorot)}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>משלוח</span>
                <span>
                  {order.delivery_fee_agorot === 0
                    ? <span className="text-emerald-600 font-semibold">חינם</span>
                    : formatPrice(order.delivery_fee_agorot)}
                </span>
              </div>
              {order.discount_agorot > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>הנחה</span>
                  <span>−{formatPrice(order.discount_agorot)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 border-t border-stone-100 pt-2">
                <span>סה&quot;כ</span>
                <span className="text-brand-700">{formatPrice(order.total_agorot)}</span>
              </div>
            </div>
          </div>

          {/* Customer details */}
          {customer && (
            <div className="bg-white rounded-2xl border border-stone-100 p-5">
              <h2 className="font-bold text-gray-900 mb-3">פרטי לקוח</h2>
              <div className="space-y-2 text-sm text-stone-600">
                {customer.name && <p className="font-medium text-gray-900">{customer.name}</p>}
                {customer.phone && (
                  <a
                    href={`tel:${customer.phone}`}
                    className="flex items-center gap-1.5 hover:text-brand-700 transition-colors"
                  >
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    {customer.phone}
                  </a>
                )}
                {customer.email && (
                  <a
                    href={`mailto:${customer.email}`}
                    className="flex items-center gap-1.5 hover:text-brand-700 transition-colors break-all"
                  >
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    {customer.email}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
