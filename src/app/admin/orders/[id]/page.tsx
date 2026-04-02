import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ArrowRight, User, MapPin, Package, CreditCard, Clock } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { ORDER_STATUS_MAP, PAYMENT_STATUS_MAP } from "@/lib/utils/order-status";
import { StatusBadge } from "@/components/admin/orders/StatusBadge";
import { OrderStatusSelect } from "@/components/admin/orders/OrderStatusSelect";

export const metadata: Metadata = { title: "פרטי הזמנה" };
export const dynamic = "force-dynamic";

// ─── Types for JSON snapshots ─────────────────────────────────────────────────

interface CustomerSnapshot {
  name:  string;
  phone: string;
  email: string;
}

interface AddressSnapshot {
  street:       string;
  house_number: string;
  apartment?:   string;
  city:         string;
  zone_name:    string;
  zone_slug?:   string;
}

interface ProductSnapshot {
  product_name:  string;
  variant_label: string;
  [key: string]: unknown;
}

// Status maps imported from shared utility — no local duplication

function formatPrice(agorot: number) {
  return `₪${(agorot / 100).toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("he-IL", {
    day:    "numeric",
    month:  "long",
    year:   "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  });
}

function SectionCard({ title, icon: Icon, children }: {
  title:    string;
  icon:     React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100">
        <div className="h-7 w-7 bg-gray-50 rounded-lg flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-gray-400" aria-hidden="true" />
        </div>
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function Row({ label, value, dir }: { label: string; value: React.ReactNode; dir?: "ltr" | "rtl" }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="font-medium text-gray-900 text-end" dir={dir}>{value ?? "—"}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id } = await params;
  const supabase = await createAdminClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select(`
      id,
      order_number,
      order_status,
      payment_status,
      payment_method,
      payment_reference,
      subtotal_agorot,
      delivery_fee_agorot,
      discount_agorot,
      total_agorot,
      customer_snapshot,
      delivery_address_snapshot,
      delivery_notes,
      requested_delivery_date,
      confirmed_delivery_date,
      created_at,
      updated_at,
      order_items (
        id,
        quantity,
        unit_price_agorot,
        total_price_agorot,
        product_snapshot
      )
    `)
    .eq("id", id)
    .single();

  if (error || !order) notFound();

  const customer = order.customer_snapshot as unknown as CustomerSnapshot;
  const address  = order.delivery_address_snapshot as unknown as AddressSnapshot;
  const items    = (order.order_items as unknown as {
    id:                 string;
    quantity:           number;
    unit_price_agorot:  number;
    total_price_agorot: number;
    product_snapshot:   unknown;
  }[]) ?? [];

  return (
    <div className="space-y-5">
      {/* Back + breadcrumb */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 border border-transparent hover:border-gray-200 transition-colors"
          aria-label="חזרה לרשימת ההזמנות"
        >
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          חזרה להזמנות
        </Link>
        <nav className="flex items-center gap-1.5 text-sm text-gray-400" aria-label="פירורי לחם">
          <ChevronRight className="h-3.5 w-3.5 rotate-180" aria-hidden="true" />
          <span className="font-mono text-gray-700 font-medium">{order.order_number}</span>
        </nav>
      </div>

      {/* Page header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{order.order_number}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{formatDate(order.created_at)}</p>
        </div>
        <div className="flex items-center gap-2 ms-auto">
          <StatusBadge map={PAYMENT_STATUS_MAP} value={order.payment_status} />
          <StatusBadge map={ORDER_STATUS_MAP}   value={order.order_status} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Left column (2/3) ─────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Order items */}
          <SectionCard title="פריטי הזמנה" icon={Package}>
            <div className="divide-y divide-gray-100">
              {items.map((item) => {
                const snap = item.product_snapshot as ProductSnapshot | null;
                return (
                  <div key={item.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {snap?.product_name ?? "מוצר לא ידוע"}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {snap?.variant_label ?? "—"} · כמות: {item.quantity}
                      </p>
                    </div>
                    <div className="text-end shrink-0">
                      <p className="text-sm font-semibold text-gray-900" dir="ltr">
                        {formatPrice(item.total_price_agorot)}
                      </p>
                      {item.quantity > 1 && (
                        <p className="text-xs text-gray-400" dir="ltr">
                          {formatPrice(item.unit_price_agorot)} × {item.quantity}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary rows */}
            <div className="border-t border-gray-100 mt-3 pt-3 space-y-0.5">
              <Row label="סכום ביניים" value={formatPrice(order.subtotal_agorot)} dir="ltr" />
              <Row label="דמי משלוח"   value={formatPrice(order.delivery_fee_agorot)} dir="ltr" />
              {order.discount_agorot > 0 && (
                <Row label="הנחה" value={`-${formatPrice(order.discount_agorot)}`} dir="ltr" />
              )}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-2">
                <span className="text-sm font-bold text-gray-900">סה&quot;כ לתשלום</span>
                <span className="text-base font-bold text-gray-900" dir="ltr">
                  {formatPrice(order.total_agorot)}
                </span>
              </div>
            </div>
          </SectionCard>

          {/* Status management */}
          <SectionCard title="ניהול סטטוס" icon={CreditCard}>
            <OrderStatusSelect
              orderId={order.id}
              orderStatus={order.order_status}
              paymentStatus={order.payment_status}
            />
          </SectionCard>
        </div>

        {/* ── Right column (1/3) ────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Customer details */}
          <SectionCard title="פרטי לקוח" icon={User}>
            <div className="space-y-0.5">
              <Row label="שם"     value={customer?.name} />
              <Row label="טלפון"  value={customer?.phone}  dir="ltr" />
              <Row label="אימייל" value={customer?.email}  dir="ltr" />
            </div>
          </SectionCard>

          {/* Delivery address */}
          <SectionCard title="כתובת למשלוח" icon={MapPin}>
            <div className="space-y-0.5">
              <Row label="רחוב"    value={`${address?.street ?? ""} ${address?.house_number ?? ""}`.trim()} />
              {address?.apartment && <Row label="דירה" value={address.apartment} />}
              <Row label="עיר"     value={address?.city} />
              <Row label="אזור"    value={address?.zone_name} />
              {order.delivery_notes && (
                <div className="pt-2 mt-2 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-500 mb-1">הערות משלוח</p>
                  <p className="text-sm text-gray-700">{order.delivery_notes}</p>
                </div>
              )}
              {order.requested_delivery_date && (
                <Row
                  label="תאריך מבוקש"
                  value={new Date(order.requested_delivery_date).toLocaleDateString("he-IL")}
                />
              )}
              {order.confirmed_delivery_date && (
                <Row
                  label="תאריך מאושר"
                  value={new Date(order.confirmed_delivery_date).toLocaleDateString("he-IL")}
                />
              )}
            </div>
          </SectionCard>

          {/* Metadata */}
          <SectionCard title="פרטי מערכת" icon={Clock}>
            <div className="space-y-0.5">
              <Row label="מזהה"     value={<span className="font-mono text-xs">{order.id.slice(0, 8)}…</span>} />
              <Row label="נוצר"     value={formatDate(order.created_at)} />
              <Row label="עודכן"    value={formatDate(order.updated_at)} />
              {order.payment_method && (
                <Row label="אמצעי תשלום" value={order.payment_method} dir="ltr" />
              )}
              {order.payment_reference && (
                <Row label="אסמכתא" value={<span className="font-mono text-xs">{order.payment_reference}</span>} />
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
