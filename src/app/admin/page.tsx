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
  ArrowLeft,
} from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/types/database";

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

export default async function AdminDashboardPage() {
  await requireAdmin();

  const supabase = await createAdminClient();

  // Per-status counts for open statuses + catalog + operations counts
  const statusCountPromises = OPEN_STATUSES.map(({ status }) =>
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("order_status", status)
      .then(({ count }) => ({ status, count: count ?? 0 }))
  );

  const [
    statusCounts,
    { count: productCount },
    { count: categoryCount },
    { count: settlementCount },
    { count: deliveryZoneCount },
  ] = await Promise.all([
    Promise.all(statusCountPromises),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("categories").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("settlements").select("id", { count: "exact", head: true }),
    supabase.from("delivery_zones").select("id", { count: "exact", head: true }),
  ]);

  const countByStatus = Object.fromEntries(
    statusCounts.map(({ status, count }) => [status, count])
  );

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
              href={`/admin/orders?status=${status}`}
            />
          ))}
        </div>
      </div>

      {/* Row 2 — Products & Categories */}
      <div>
        <RowHeader title="קטלוג" />
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label="מוצרים פעילים"
            value={productCount ?? "—"}
            icon={<ShoppingBag className="h-5 w-5 text-brand-600" />}
            iconBg="bg-brand-50"
            href="/admin/products"
          />
          <StatCard
            label="קטגוריות פעילות"
            value={categoryCount ?? "—"}
            icon={<Tag className="h-5 w-5 text-purple-600" />}
            iconBg="bg-purple-50"
            href="/admin/categories"
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
            href="/admin/settlements"
          />
          <StatCard
            label="אזורי חלוקה"
            value={deliveryZoneCount ?? "—"}
            icon={<Map className="h-5 w-5 text-sky-600" />}
            iconBg="bg-sky-50"
            href="/admin/delivery-zones"
          />
        </div>
      </div>
    </div>
  );
}
