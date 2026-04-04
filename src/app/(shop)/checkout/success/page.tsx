import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Package, Phone, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { formatPrice } from "@/lib/utils/money";
import type { Database } from "@/types/database";

export const metadata: Metadata = {
  title: "ההזמנה התקבלה | משק 22",
};

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_payment:  "ממתין לתשלום",
  confirmed:        "אושר",
  preparing:        "בהכנה",
  out_for_delivery: "בדרך אליכם",
  delivered:        "נמסר",
  cancelled:        "בוטל",
};

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderNumber } = await searchParams;

  let order: OrderRow | null = null;

  if (orderNumber) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("order_number", orderNumber)
      .single();
    order = (data as OrderRow | null) ?? null;
  }

  // Extract customer info from snapshot
  const customerSnapshot = order?.customer_snapshot as
    | { name?: string; email?: string; phone?: string }
    | null;

  const addressSnapshot = order?.delivery_address_snapshot as
    | { street?: string; house_number?: string; city?: string; zone_name?: string }
    | null;

  const isPaid = order?.payment_status === "paid";

  return (
    <main
      className="flex-1 py-12 lg:py-20"
      style={{ backgroundColor: "var(--color-surface)" }}
    >
      <Container>
        <div className="max-w-lg mx-auto">
          {/* Status icon */}
          <div className="text-center mb-8">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 mb-5">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {isPaid ? "ההזמנה שולמה ✓" : "ההזמנה התקבלה"}
            </h1>
            <p className="text-stone-500 leading-relaxed">
              {isPaid
                ? "התשלום אושר. נתחיל לארוז את ההזמנה שלכם בהקדם."
                : "ההזמנה שלכם נשמרה. עם קבלת אישור התשלום נתחיל בהכנה."}
            </p>
          </div>

          {/* Order card */}
          {order && (
            <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden mb-6">
              {/* Header */}
              <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-stone-400 mb-0.5">מספר הזמנה</p>
                  <p className="font-bold text-gray-900 font-mono tracking-wide">
                    {order.order_number}
                  </p>
                </div>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-100 text-emerald-700">
                  {ORDER_STATUS_LABELS[order.order_status] ?? order.order_status}
                </span>
              </div>

              {/* Details */}
              <div className="px-5 py-4 space-y-3 text-sm">
                {customerSnapshot?.name && (
                  <div className="flex justify-between gap-3">
                    <span className="text-stone-500">שם</span>
                    <span className="font-medium text-gray-900">
                      {customerSnapshot.name}
                    </span>
                  </div>
                )}

                {addressSnapshot?.city && (
                  <div className="flex justify-between gap-3">
                    <span className="text-stone-500">כתובת</span>
                    <span className="font-medium text-gray-900 text-end">
                      {addressSnapshot.street} {addressSnapshot.house_number},{" "}
                      {addressSnapshot.city}
                    </span>
                  </div>
                )}

                <div className="flex justify-between gap-3">
                  <span className="text-stone-500">סכום מוצרים</span>
                  <span className="font-medium text-gray-900">
                    {formatPrice(order.subtotal_agorot)}
                  </span>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-stone-500">דמי משלוח</span>
                  <span className="font-medium text-gray-900">
                    {order.delivery_fee_agorot === 0
                      ? "חינם"
                      : formatPrice(order.delivery_fee_agorot)}
                  </span>
                </div>

                <div className="flex justify-between gap-3 border-t border-stone-100 pt-3">
                  <span className="font-bold text-gray-900">סה&quot;כ</span>
                  <span className="font-bold text-brand-700 text-lg">
                    {formatPrice(order.total_agorot)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {!order && orderNumber && (
            <div className="bg-white rounded-2xl border border-stone-100 p-5 mb-6 text-center">
              <p className="text-stone-500 text-sm">
                מספר הזמנה: <span className="font-mono font-bold text-gray-900">{orderNumber}</span>
              </p>
            </div>
          )}

          {/* What's next */}
          <div className="bg-brand-50 border border-brand-100 rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-4 w-4 text-brand-600" />
              <h2 className="font-semibold text-brand-800 text-sm">מה קורה עכשיו?</h2>
            </div>
            <ol className="space-y-2 text-sm text-brand-700 list-decimal list-inside">
              <li>נשלח לכם אישור בדוא&quot;ל עם פרטי ההזמנה</li>
              <li>הצוות שלנו יאשר ויתחיל לארוז</li>
              <li>ההזמנה תצא ממשק 22 לפי לוח הזמנים של אזור המשלוח</li>
              <li>תקבלו עדכון כשהמשלוח בדרך אליכם</li>
            </ol>
          </div>

          {/* Support */}
          <div className="text-center text-sm text-stone-500 mb-8">
            <p className="mb-1">שאלות? אנחנו כאן לעזור.</p>
            <a
              href="tel:*3722"
              className="inline-flex items-center gap-1.5 text-brand-700 hover:text-brand-800 font-medium transition-colors"
            >
              <Phone className="h-3.5 w-3.5" />
              *3722
            </a>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/account/orders"
              className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-full border border-brand-300 text-brand-700 font-semibold text-sm hover:bg-brand-50 transition-colors"
            >
              ההזמנות שלי
            </Link>
            <Link
              href="/category/yerakot"
              className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-full bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors"
            >
              המשיכו לקנות
              <ArrowRight className="h-4 w-4 rotate-180" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </Container>
    </main>
  );
}
