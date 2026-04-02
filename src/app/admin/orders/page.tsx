import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { fetchOrdersPage } from "./actions";
import { OrderFilters } from "@/components/admin/orders/OrderFilters";
import { OrdersListClient } from "@/components/admin/orders/OrdersListClient";

export const metadata: Metadata = { title: "הזמנות" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    search?:  string;
    status?:  string;
    payment?: string;
  }>;
}

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  await requireAdmin();

  const { search = "", status = "", payment = "" } = await searchParams;

  const filters = { search, status, payment };
  const { orders, nextCursor } = await fetchOrdersPage(null, filters);

  const hasActiveFilters = !!(search || status || payment);

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">הזמנות</h1>
          {orders.length > 0 && (
            <p className="text-sm text-gray-500 mt-1">
              {hasActiveFilters ? `${orders.length}+ תוצאות` : `${orders.length}${nextCursor ? "+" : ""} הזמנות`}
            </p>
          )}
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4">
        <OrderFilters
          search={search}
          statusFilter={status}
          paymentFilter={payment}
        />
      </div>

      {/* ── Orders list (client component handles empty states + load more) ── */}
      <OrdersListClient
        key={`${search}|${status}|${payment}`}
        initialOrders={orders}
        initialNextCursor={nextCursor}
        filters={filters}
        hasActiveFilters={hasActiveFilters}
      />
    </div>
  );
}
