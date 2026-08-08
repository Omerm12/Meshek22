import type { Metadata } from "next";
import Link from "next/link";
import {
  Clock,
  CheckCircle2,
  PackageSearch,
  Truck,
  ShoppingBag,
  Tag,
  MapPin,
  Map,
  Percent,
  ArrowLeft,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/types/database";
import { ADMIN_BASE_PATH } from "@/lib/admin/routes";

export const metadata: Metadata = { title: "לוח בקרה" };
export const dynamic = "force-dynamic";

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  iconBg: string;
  href: string;
}

function StatCard({ label, value, icon, iconBg, href }: StatCardProps) {
  return (
    <Link
      href={href}
      className="group bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4 hover:border-brand-300 hover:shadow-sm transition-all"
    >
      <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
        <p className="text-sm text-gray-500 truncate">{label}</p>
      </div>
      <ArrowLeft className="h-4 w-4 text-gray-300 group-hover:text-brand-500 transition-colors rotate-180 shrink-0" aria-hidden="true" />
    </Link>
  );
}

// ─── Row header ───────────────────────────────────────────────────────────────

function RowHeader({ title }: { title: string }) {
  return <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</h2>;
}

// ─── Open order statuses shown in row 1 ──────────────────────────────────────

const OPEN_STATUSES: { status: OrderStatus; label: string; icon: React.ReactNode; iconBg: string }[] = [
  {
    status: "pending_payment",
    label: "ממתין לתשלום",
    icon: <Clock className="h-5 w-5 text-yellow-600" />,
    iconBg: "bg-yellow-50",
  },
  {
    status: "confirmed",
    label: "אושר",
    icon: <CheckCircle2 className="h-5 w-5 text-indigo-600" />,
    iconBg: "bg-indigo-50",
  },
  {
    status: "preparing",
    label: "בהכנה",
    icon: <PackageSearch className="h-5 w-5 text-purple-600" />,
    iconBg: "bg-purple-50",
  },
  {
    status: "out_for_delivery",
    label: "בדרך",
    icon: <Truck className="h-5 w-5 text-orange-600" />,
    iconBg: "bg-orange-50",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

interface DashboardCounts {
  orders_pending_payment: number;
  orders_confirmed: number;
  orders_preparing: number;
  orders_out_for_delivery: number;
  products_active: number;
  categories_active: number;
  settlements: number;
  delivery_zones: number;
  promotions_active: number;
}

export default async function AdminDashboardPage() {
  // Authorization already ran in (protected)/layout.tsx for this request.
  // requireAdmin() is memoised, but the page does not need to call it at all —
  // it cannot render unless the layout above it succeeded.
  const supabase = createAdminClient();

  // One RPC replaces the eight separate head-only COUNT round-trips this page
  // used to issue. Each of those cost a full PostgREST request (TLS + auth +
  // planning) even though the queries themselves were trivial.
  const { data, error } = await supabase.rpc("admin_dashboard_counts");

  if (error) {
    console.error("[admin:dashboard] counts RPC failed", { error: error.message });
  }

  const counts = (data ?? {}) as Partial<DashboardCounts>;

  const countByStatus: Record<string, number> = {
    pending_payment:  counts.orders_pending_payment  ?? 0,
    confirmed:        counts.orders_confirmed        ?? 0,
    preparing:        counts.orders_preparing        ?? 0,
    out_for_delivery: counts.orders_out_for_delivery ?? 0,
  };

  const productCount      = counts.products_active   ?? null;
  const categoryCount     = counts.categories_active ?? null;
  const settlementCount   = counts.settlements       ?? null;
  const deliveryZoneCount = counts.delivery_zones    ?? null;
  const promotionCount    = counts.promotions_active ?? null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">לוח בקרה</h1>
        <p className="text-sm text-gray-500 mt-1">סקירה תפעולית של פעילות החנות</p>
      </div>

      {/* Row 1 — Open orders by status */}
      <div>
        <RowHeader title="הזמנות פתוחות לפי סטטוס" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {OPEN_STATUSES.map(({ status, label, icon, iconBg }) => (
            <StatCard
              key={status}
              label={label}
              value={countByStatus[status] ?? 0}
              icon={icon}
              iconBg={iconBg}
              href={`${ADMIN_BASE_PATH}/orders?status=${status}`}
            />
          ))}
        </div>
      </div>

      {/* Row 2 — Products, Categories & Promotions */}
      <div>
        <RowHeader title="קטלוג" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            label="מוצרים פעילים"
            value={productCount ?? "—"}
            icon={<ShoppingBag className="h-5 w-5 text-brand-600" />}
            iconBg="bg-brand-50"
            href={`${ADMIN_BASE_PATH}/products`}
          />
          <StatCard
            label="קטגוריות פעילות"
            value={categoryCount ?? "—"}
            icon={<Tag className="h-5 w-5 text-purple-600" />}
            iconBg="bg-purple-50"
            href={`${ADMIN_BASE_PATH}/categories`}
          />
          <StatCard
            label="מבצעים פעילים"
            value={promotionCount ?? "—"}
            icon={<Percent className="h-5 w-5 text-orange-600" />}
            iconBg="bg-orange-50"
            href={`${ADMIN_BASE_PATH}/promotions`}
          />
        </div>
      </div>

      {/* Row 3 — Settlements & Delivery zones */}
      <div>
        <RowHeader title="אזורי משלוח" />
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label="יישובים"
            value={settlementCount ?? "—"}
            icon={<MapPin className="h-5 w-5 text-teal-600" />}
            iconBg="bg-teal-50"
            href={`${ADMIN_BASE_PATH}/settlements`}
          />
          <StatCard
            label="אזורי חלוקה"
            value={deliveryZoneCount ?? "—"}
            icon={<Map className="h-5 w-5 text-sky-600" />}
            iconBg="bg-sky-50"
            href={`${ADMIN_BASE_PATH}/delivery-zones`}
          />
        </div>
      </div>
    </div>
  );
}
