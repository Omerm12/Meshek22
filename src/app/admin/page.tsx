import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingBag, Tag, ClipboardList, ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "לוח בקרה" };

// No ISR — dashboard shows live counts
export const dynamic = "force-dynamic";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  href: string;
  color: string;
}

function StatCard({ label, value, icon, href, color }: StatCardProps) {
  return (
    <Link
      href={href}
      className="group bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4 hover:border-brand-300 hover:shadow-sm transition-all"
    >
      <div
        className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
      <ArrowLeft className="h-4 w-4 text-gray-300 group-hover:text-brand-500 transition-colors rotate-180" aria-hidden="true" />
    </Link>
  );
}

export default async function AdminDashboardPage() {
  // Guard is also called here directly so this page is independently protected
  // even if someone somehow bypasses the layout (defense-in-depth).
  await requireAdmin();

  // Fetch live counts using the service-role client (bypasses RLS).
  const supabase = await createAdminClient();

  const [
    { count: orderCount },
    { count: productCount },
    { count: categoryCount },
  ] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("categories").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">לוח בקרה</h1>
        <p className="text-sm text-gray-500 mt-1">סקירה כללית של פעילות החנות</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="הזמנות"
          value={orderCount ?? "—"}
          icon={<ClipboardList className="h-6 w-6 text-blue-600" />}
          href="/admin/orders"
          color="bg-blue-50"
        />
        <StatCard
          label="מוצרים פעילים"
          value={productCount ?? "—"}
          icon={<ShoppingBag className="h-6 w-6 text-brand-600" />}
          href="/admin/products"
          color="bg-brand-50"
        />
        <StatCard
          label="קטגוריות"
          value={categoryCount ?? "—"}
          icon={<Tag className="h-6 w-6 text-purple-600" />}
          href="/admin/categories"
          color="bg-purple-50"
        />
      </div>

      {/* Quick links */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">ניהול מהיר</h2>
        <div className="flex flex-wrap gap-2">
          {[
            { href: "/admin/orders",     label: "כל ההזמנות" },
            { href: "/admin/products",   label: "ניהול מוצרים" },
            { href: "/admin/categories", label: "ניהול קטגוריות" },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:border-brand-400 hover:text-brand-700 transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
