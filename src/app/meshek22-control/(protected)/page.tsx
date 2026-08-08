import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardList,
  Map,
  MapPin,
  Package,
  PackageSearch,
  Percent,
  PhoneCall,
  ShoppingBag,
  Store,
  Tag,
  Truck,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { ADMIN_BASE_PATH } from "@/lib/admin/routes";
import { loadDashboardCounts } from "@/lib/admin/dashboard-counts";
import {
  EXCLUDE_INCOMPLETE_CARDCOM,
  filterRows,
  ordersTable,
  selectOrdersWithFallback,
} from "@/lib/admin/orders-data";
import {
  describeFulfillment,
  describeOrderStatus,
  describePaymentState,
} from "@/lib/admin/order-presentation";
import type { OperationalBucket } from "@/lib/admin/order-presentation";

export const metadata: Metadata = { title: "לוח בקרה" };
// Live operational data — never served from a cache.
export const dynamic = "force-dynamic";

const RECENT_ORDERS_LIMIT = 10;

function formatPrice(agorot: number) {
  return `₪${(agorot / 100).toLocaleString("he-IL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("he-IL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Attention cards ──────────────────────────────────────────────────────────

interface AttentionCard {
  bucket: OperationalBucket;
  title: string;
  hint: string;
  icon: React.ReactNode;
  iconBg: string;
  ring: string;
}

const ATTENTION_CARDS: AttentionCard[] = [
  {
    bucket: "awaiting_payment_call",
    title: "ממתינות לשיחת תשלום",
    hint: "לקוחות שביקשו שנחזור אליהם לקבלת תשלום",
    icon: <PhoneCall className="h-6 w-6 text-amber-700" />,
    iconBg: "bg-amber-100",
    ring: "hover:border-amber-300",
  },
  {
    bucket: "new",
    title: "הזמנות חדשות",
    hint: "אושרו וממתינות שתתחילו להכין אותן",
    icon: <ClipboardList className="h-6 w-6 text-indigo-700" />,
    iconBg: "bg-indigo-100",
    ring: "hover:border-indigo-300",
  },
  {
    bucket: "preparing",
    title: "בהכנה",
    hint: "נארזות עכשיו במשק",
    icon: <PackageSearch className="h-6 w-6 text-purple-700" />,
    iconBg: "bg-purple-100",
    ring: "hover:border-purple-300",
  },
  {
    bucket: "out_for_delivery",
    title: "יצאו למשלוח",
    hint: "בדרך אל הלקוח",
    icon: <Truck className="h-6 w-6 text-orange-700" />,
    iconBg: "bg-orange-100",
    ring: "hover:border-orange-300",
  },
  {
    bucket: "ready_for_pickup",
    title: "מוכנות לאיסוף",
    hint: "ארוזות וממתינות ללקוח במשק",
    icon: <Store className="h-6 w-6 text-teal-700" />,
    iconBg: "bg-teal-100",
    ring: "hover:border-teal-300",
  },
];

function AttentionCardTile({
  card,
  value,
}: {
  card: AttentionCard;
  value: number | null;
}) {
  return (
    <Link
      href={`${ADMIN_BASE_PATH}/orders?status=${card.bucket}`}
      className={`group bg-white rounded-2xl border border-gray-200 p-5 flex flex-col gap-3 transition-all hover:shadow-sm ${card.ring}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${card.iconBg}`}>
          {card.icon}
        </div>
        <p className="text-4xl font-bold text-gray-900 tabular-nums">
          {value ?? "—"}
        </p>
      </div>
      <div>
        <p className="font-bold text-gray-900 leading-snug">{card.title}</p>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{card.hint}</p>
      </div>
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 mt-auto pt-1">
        לצפייה בהזמנות
        <ArrowLeft className="h-3.5 w-3.5 rotate-180 group-hover:-translate-x-0.5 transition-transform" aria-hidden="true" />
      </span>
    </Link>
  );
}

// ─── Secondary config tile ────────────────────────────────────────────────────

function ConfigTile({
  label,
  value,
  icon,
  href,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3 hover:border-brand-300 transition-colors"
    >
      <span className="text-gray-400 shrink-0" aria-hidden="true">{icon}</span>
      <span className="text-sm text-gray-600 truncate">{label}</span>
      <span className="ms-auto text-sm font-bold text-gray-900 tabular-nums">{value}</span>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminDashboardPage() {
  // Authorization already ran in (protected)/layout.tsx for this request.
  const supabase = createAdminClient();

  // Counts and recent orders are independent: a failure in one must not blank
  // the other, so they are awaited together rather than sequentially.
  const [counts, recent] = await Promise.all([
    loadDashboardCounts(supabase),
    selectOrdersWithFallback((columns) =>
      ordersTable(supabase)
        .select(columns)
        .or(EXCLUDE_INCOMPLETE_CARDCOM)
        .order("created_at", { ascending: false })
        // Over-fetch a little: filterRows drops anything the query could not.
        .limit(RECENT_ORDERS_LIMIT * 2)
    ),
  ]);

  // Incomplete online-card attempts are not operational orders and never appear
  // in the recent list.
  const recentOrders = filterRows(recent.rows).slice(0, RECENT_ORDERS_LIMIT);
  const showWarning = counts.hasErrors || recent.error !== null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">לוח בקרה</h1>
        <p className="text-sm text-gray-500 mt-1">מה דורש טיפול עכשיו</p>
      </div>

      {/* A failed count is reported, never rendered as a convincing zero. */}
      {showWarning && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>חלק מנתוני לוח הבקרה לא נטענו. נסו לרענן.</span>
        </div>
      )}

      {/* ── Primary: what needs attention ── */}
      <section aria-labelledby="attention-heading">
        <h2 id="attention-heading" className="sr-only">הזמנות הדורשות טיפול</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {ATTENTION_CARDS.map((card) => (
            <AttentionCardTile key={card.bucket} card={card} value={counts.buckets[card.bucket]} />
          ))}
        </div>
      </section>

      {/* ── Recent orders ── */}
      <section aria-labelledby="recent-heading">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 id="recent-heading" className="text-lg font-bold text-gray-900">
            הזמנות אחרונות
          </h2>
          <Link
            href={`${ADMIN_BASE_PATH}/orders`}
            className="text-sm font-semibold text-brand-700 hover:text-brand-800 transition-colors"
          >
            כל ההזמנות
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
            <Package className="h-8 w-8 text-gray-300 mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm font-semibold text-gray-900">
              {recent.error ? "לא ניתן לטעון את ההזמנות כרגע" : "אין הזמנות עדיין"}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {recent.error ? "נסו לרענן את הדף." : "הזמנות חדשות יופיעו כאן."}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {recentOrders.map((order) => {
              const ctx = {
                orderStatus: order.order_status,
                paymentStatus: order.payment_status,
                paymentMethod: order.payment_method,
                fulfillmentMethod: order.fulfillment_method,
              };
              const status = describeOrderStatus(ctx);
              const payment = describePaymentState(ctx);
              const fulfillment = describeFulfillment(ctx);
              const customer = order.customer_snapshot as
                | { name?: string; phone?: string }
                | null;

              return (
                <li
                  key={order.id}
                  className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Identity */}
                    <div className="min-w-0 lg:w-56">
                      <p className="font-mono text-xs text-gray-500">{order.order_number}</p>
                      <p className="font-bold text-gray-900 truncate mt-0.5">
                        {customer?.name ?? "—"}
                      </p>
                      <p className="text-sm text-gray-500 mt-0.5" dir="ltr">
                        {customer?.phone ?? "—"}
                      </p>
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap items-center gap-2 flex-1">
                      <span className={`inline-flex items-center h-7 px-3 rounded-full text-xs font-semibold border ${status.cls}`}>
                        {status.label}
                      </span>
                      <span className={`inline-flex items-center h-7 px-3 rounded-full text-xs font-semibold border ${payment.cls}`}>
                        {payment.label}
                      </span>
                      <span className={`inline-flex items-center h-7 px-3 rounded-full text-xs font-semibold border ${fulfillment.cls}`}>
                        {fulfillment.label}
                      </span>
                    </div>

                    {/* Money + action */}
                    <div className="flex items-center justify-between gap-4 lg:justify-end lg:w-64">
                      <div className="text-start lg:text-end">
                        <p className="font-bold text-gray-900 tabular-nums" dir="ltr">
                          {formatPrice(order.total_agorot)}
                        </p>
                        <p className="text-xs text-gray-400">{formatDate(order.created_at)}</p>
                      </div>
                      <Link
                        href={`${ADMIN_BASE_PATH}/orders/${order.id}`}
                        className="inline-flex items-center justify-center h-11 px-5 rounded-xl bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 transition-colors shrink-0"
                      >
                        פתיחת הזמנה
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Secondary: catalog & delivery configuration ── */}
      <section aria-labelledby="config-heading">
        <h2 id="config-heading" className="text-sm font-semibold text-gray-500 mb-3">
          קטלוג והגדרות
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          <ConfigTile
            label="מוצרים פעילים"
            value={counts.productsActive ?? "—"}
            icon={<ShoppingBag className="h-4 w-4" />}
            href={`${ADMIN_BASE_PATH}/products`}
          />
          <ConfigTile
            label="קטגוריות"
            value={counts.categoriesActive ?? "—"}
            icon={<Tag className="h-4 w-4" />}
            href={`${ADMIN_BASE_PATH}/categories`}
          />
          <ConfigTile
            label="מבצעים פעילים"
            // The promotions table ships with a migration that may not be applied
            // yet; that is expected and must not look like a failure.
            value={counts.promotionsUnavailable ? "לא זמין" : counts.promotionsActive ?? "—"}
            icon={<Percent className="h-4 w-4" />}
            href={`${ADMIN_BASE_PATH}/promotions`}
          />
          <ConfigTile
            label="יישובים"
            value={counts.settlements ?? "—"}
            icon={<MapPin className="h-4 w-4" />}
            href={`${ADMIN_BASE_PATH}/settlements`}
          />
          <ConfigTile
            label="אזורי חלוקה"
            value={counts.deliveryZones ?? "—"}
            icon={<Map className="h-4 w-4" />}
            href={`${ADMIN_BASE_PATH}/delivery-zones`}
          />
        </div>
      </section>
    </div>
  );
}
