import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Clock, Package, Phone, Store, ArrowRight } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { formatPrice } from "@/lib/utils/money";
import type { Database } from "@/types/database";
import { PaymentStatusPoller } from "@/components/checkout/PaymentStatusPoller";
import { ClearCartOnMount } from "@/components/checkout/ClearCartOnMount";
import {
  PICKUP_LOCATION,
  fulfillmentMethodLabel,
  paymentMethodLabel,
} from "@/lib/checkout/constants";
import {
  hashGuestAccessToken,
  isPlausibleGuestToken,
} from "@/lib/checkout/guest-token";

export const metadata: Metadata = {
  title: "ההזמנה התקבלה | משק 22",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_payment:  "ממתין לתשלום",
  confirmed:        "אושר",
  preparing:        "בהכנה",
  out_for_delivery: "בדרך אליכם",
  delivered:        "נמסר",
  cancelled:        "בוטל",
};

/**
 * Guest order confirmation.
 *
 * The order is fetched by order number AND the SHA-256 of the access token from
 * the URL. Without a valid token nothing is returned, so an order number on its
 * own — guessed, shoulder-surfed or brute-forced — reveals nothing. The same
 * "not found" screen is shown whether the order does not exist or the token is
 * wrong, so the page cannot be used to probe for valid order numbers.
 */
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; t?: string }>;
}) {
  const { order: orderNumber, t: token } = await searchParams;

  let order: OrderRow | null = null;

  if (orderNumber && isPlausibleGuestToken(token)) {
    const db = createAdminClient();
    const { data } = await db
      .from("orders")
      .select("*")
      .eq("order_number", orderNumber)
      .eq("guest_access_token_hash", hashGuestAccessToken(token))
      .maybeSingle();
    order = (data as OrderRow | null) ?? null;
  }

  if (!order) {
    return (
      <main className="flex-1 py-12 lg:py-20" style={{ backgroundColor: "var(--color-surface)" }}>
        <Container>
          <div className="max-w-lg mx-auto text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-3">ההזמנה לא נמצאה</h1>
            <p className="text-stone-500 leading-relaxed mb-8">
              ייתכן שהקישור אינו מלא או שפג תוקפו. אם ביצעתם הזמנה, אישור נשלח אליכם בדוא&quot;ל.
              נשמח לעזור בטלפון 050-8863030.
            </p>
            <Link
              href="/"
              className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors"
            >
              חזרה לדף הבית
            </Link>
          </div>
        </Container>
      </main>
    );
  }

  const customerSnapshot = order.customer_snapshot as
    | { name?: string; email?: string; phone?: string }
    | null;

  const addressSnapshot = order.delivery_address_snapshot as
    | { street?: string; house_number?: string; city?: string; zone_name?: string }
    | null;

  const isPickup      = order.fulfillment_method === "pickup";
  const isOnlineCard  = order.payment_method === "credit_card";
  const isPaid        = order.payment_status === "paid";

  // ── Online card, payment not yet confirmed: poll for the webhook ──────────
  // This is the normal path when the customer lands before CardCom's webhook
  // has arrived. The cart is deliberately NOT cleared yet.
  if (isOnlineCard && !isPaid) {
    return (
      <main className="flex-1 py-12 lg:py-20" style={{ backgroundColor: "var(--color-surface)" }}>
        <Container>
          <div className="max-w-lg mx-auto">
            <div className="text-center mb-8">
              {/* Deliberately NOT "your order was received": until CardCom
                  verifies the payment there is no order for the shop to pack,
                  and saying otherwise would mislead the customer. */}
              <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-amber-50 mb-5">
                <Clock className="h-10 w-10 text-amber-400" aria-hidden="true" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">בודקים את התשלום</h1>
              <p className="text-stone-500 text-sm leading-relaxed">
                ההזמנה תיקלט לטיפול מיד עם אישור חברת האשראי.
                <br />
                מספר הזמנה:{" "}
                <span className="font-mono font-bold text-gray-900">{order.order_number}</span>
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-stone-100 p-6 sm:p-8">
              <PaymentStatusPoller orderNumber={order.order_number} token={token!} />
            </div>
          </div>
        </Container>
      </main>
    );
  }

  // Past this point the order is either paid online or accepted offline, so the
  // basket has served its purpose and can be emptied.
  const headline = isPaid
    ? "התשלום התקבל בהצלחה"
    : order.payment_method === "cash"
      ? "ההזמנה התקבלה"
      : "ההזמנה התקבלה — נחזור אליכם";

  const subheadline = isPaid
    ? "תודה! ההזמנה שלך התקבלה ונשלחה לטיפול."
    : order.payment_method === "cash"
      ? isPickup
        ? "התשלום במזומן יבוצע בעת האיסוף במשק."
        : "התשלום במזומן יבוצע בעת מסירת המשלוח."
      : "נציג שלנו יתקשר אליכם לקבלת פרטי האשראי והשלמת התשלום.";

  return (
    <main className="flex-1 py-12 lg:py-20" style={{ backgroundColor: "var(--color-surface)" }}>
      <ClearCartOnMount />
      <Container>
        <div className="max-w-lg mx-auto">
          {/* Status icon */}
          <div className="text-center mb-8">
            <div
              className={`inline-flex h-20 w-20 items-center justify-center rounded-full mb-5 ${
                isPaid ? "bg-emerald-100" : "bg-amber-100"
              }`}
            >
              {isPaid ? (
                <CheckCircle2 className="h-10 w-10 text-emerald-500" aria-hidden="true" />
              ) : (
                <Clock className="h-10 w-10 text-amber-500" aria-hidden="true" />
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{headline}</h1>
            <p className="text-stone-500 leading-relaxed">{subheadline}</p>
          </div>

          {/* Order card */}
          <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden mb-6">
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-stone-400 mb-0.5">מספר הזמנה</p>
                <p className="font-bold text-gray-900 font-mono tracking-wide">
                  {order.order_number}
                </p>
              </div>
              <span
                className={`text-xs font-semibold px-3 py-1 rounded-full ${
                  isPaid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                }`}
              >
                {ORDER_STATUS_LABELS[order.order_status] ?? order.order_status}
              </span>
            </div>

            <div className="px-5 py-4 space-y-3 text-sm">
              {customerSnapshot?.name && (
                <div className="flex justify-between gap-3">
                  <span className="text-stone-500">שם</span>
                  <span className="font-medium text-gray-900">{customerSnapshot.name}</span>
                </div>
              )}

              <div className="flex justify-between gap-3">
                <span className="text-stone-500">אופן קבלה</span>
                <span className="font-medium text-gray-900">
                  {fulfillmentMethodLabel(order.fulfillment_method)}
                </span>
              </div>

              {isPickup ? (
                <div className="flex justify-between gap-3">
                  <span className="text-stone-500">נקודת איסוף</span>
                  <span className="font-medium text-gray-900 text-end">{PICKUP_LOCATION.name}</span>
                </div>
              ) : (
                addressSnapshot?.city && (
                  <div className="flex justify-between gap-3">
                    <span className="text-stone-500">כתובת</span>
                    <span className="font-medium text-gray-900 text-end">
                      {addressSnapshot.street} {addressSnapshot.house_number},{" "}
                      {addressSnapshot.city}
                    </span>
                  </div>
                )
              )}

              <div className="flex justify-between gap-3">
                <span className="text-stone-500">אמצעי תשלום</span>
                <span className="font-medium text-gray-900 text-end">
                  {paymentMethodLabel(order.payment_method)}
                </span>
              </div>

              <div className="flex justify-between gap-3">
                <span className="text-stone-500">סכום מוצרים</span>
                <span className="font-medium text-gray-900">
                  {formatPrice(order.subtotal_agorot)}
                </span>
              </div>

              {order.discount_agorot > 0 && (
                <div className="flex justify-between gap-3">
                  <span className="text-orange-600">הנחת מבצעים</span>
                  <span className="font-medium text-orange-600">
                    −{formatPrice(order.discount_agorot)}
                  </span>
                </div>
              )}

              <div className="flex justify-between gap-3">
                <span className="text-stone-500">
                  {isPickup ? "איסוף עצמי" : "דמי משלוח"}
                </span>
                <span className="font-medium text-gray-900">
                  {order.delivery_fee_agorot === 0
                    ? "ללא עלות"
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

          {/* Pickup instructions */}
          {isPickup && (
            <div className="bg-brand-50 border border-brand-100 rounded-2xl p-5 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Store className="h-4 w-4 text-brand-600" />
                <h2 className="font-semibold text-brand-800 text-sm">איסוף עצמי</h2>
              </div>
              <p className="text-sm text-brand-700 leading-relaxed">
                {PICKUP_LOCATION.name}
                <br />
                {PICKUP_LOCATION.coordinationNote}
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
              {order.payment_method === "phone_credit" && (
                <li>נציג יתקשר אליכם לקבלת פרטי האשראי</li>
              )}
              <li>הצוות שלנו יאשר ויתחיל לארוז</li>
              {isPickup ? (
                <li>ניצור קשר לתיאום מועד האיסוף במשק</li>
              ) : (
                <li>ההזמנה תצא ממשק 22 לפי לוח הזמנים של אזור המשלוח</li>
              )}
            </ol>
          </div>

          {/* Support */}
          <div className="text-center text-sm text-stone-500 mb-8">
            <p className="mb-1">שאלות? אנחנו כאן לעזור.</p>
            <a
              href="tel:0508863030"
              className="inline-flex items-center gap-1.5 text-brand-700 hover:text-brand-800 font-medium transition-colors"
            >
              <Phone className="h-3.5 w-3.5" />
              050-8863030
            </a>
          </div>

          {/* CTA */}
          <Link
            href="/vegetables"
            className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-full bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors"
          >
            המשיכו לקנות
            <ArrowRight className="h-4 w-4 rotate-180" aria-hidden="true" />
          </Link>
        </div>
      </Container>
    </main>
  );
}
