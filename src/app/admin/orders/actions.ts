"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { ORDER_STATUS_MAP, PAYMENT_STATUS_MAP } from "@/lib/utils/order-status";
import type { OrderStatus, PaymentStatus } from "@/types/database";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrderRow {
  id:               string;
  order_number:     string;
  order_status:     string;
  payment_status:   string;
  total_agorot:     number;
  created_at:       string;
  customer_snapshot: unknown;
}

export interface OrderPageFilters {
  search?:  string;
  status?:  string;
  payment?: string;
}

export interface OrderPageResult {
  orders:     OrderRow[];
  nextCursor: string | null;
}

const PAGE_SIZE = 20;

// ─── fetchOrdersPage ──────────────────────────────────────────────────────────

export async function fetchOrdersPage(
  cursor: string | null,
  filters: OrderPageFilters
): Promise<OrderPageResult> {
  await requireAdmin();

  const supabase = await createAdminClient();

  const term = filters.search?.trim().toLowerCase() ?? "";

  // When text search is active we can't combine cursor pagination with
  // application-level filtering reliably, so fetch all matching DB rows.
  const usingTextSearch = !!term;

  let query = supabase
    .from("orders")
    .select("id, order_number, order_status, payment_status, total_agorot, created_at, customer_snapshot")
    .order("created_at", { ascending: false })
    .order("id",         { ascending: false });

  if (!usingTextSearch) {
    query = query.limit(PAGE_SIZE + 1);
  }

  // Enum filters
  if (filters.status && Object.keys(ORDER_STATUS_MAP).includes(filters.status)) {
    query = query.eq("order_status", filters.status as OrderStatus);
  }
  if (filters.payment && Object.keys(PAYMENT_STATUS_MAP).includes(filters.payment)) {
    query = query.eq("payment_status", filters.payment as PaymentStatus);
  }

  // Cursor condition (only when not doing text search)
  if (!usingTextSearch && cursor) {
    const [cursorDate, cursorId] = cursor.split("|");
    if (cursorDate && cursorId) {
      query = query.or(
        `created_at.lt.${cursorDate},and(created_at.eq.${cursorDate},id.lt.${cursorId})`
      );
    }
  }

  const { data: raw, error } = await query;

  if (error || !raw) return { orders: [], nextCursor: null };

  // Server-side text search
  const filtered = term
    ? raw.filter((o) => {
        const c = o.customer_snapshot as { name?: string; phone?: string } | null;
        return (
          o.order_number.toLowerCase().includes(term) ||
          c?.name?.toLowerCase().includes(term) ||
          (c?.phone ?? "").includes(term)
        );
      })
    : raw;

  if (usingTextSearch) {
    return { orders: filtered as OrderRow[], nextCursor: null };
  }

  const hasMore = filtered.length > PAGE_SIZE;
  const orders  = (hasMore ? filtered.slice(0, PAGE_SIZE) : filtered) as OrderRow[];

  const last       = orders[orders.length - 1];
  const nextCursor = hasMore && last ? `${last.created_at}|${last.id}` : null;

  return { orders, nextCursor };
}

export type ActionResult = { success: true } | { success: false; error: string };

const VALID_ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;

const VALID_PAYMENT_STATUSES = [
  "pending",
  "paid",
  "failed",
  "refunded",
] as const;

type ValidOrderStatus   = (typeof VALID_ORDER_STATUSES)[number];
type ValidPaymentStatus = (typeof VALID_PAYMENT_STATUSES)[number];

export async function updateOrderStatuses(
  orderId: string,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();

  const orderStatus   = formData.get("order_status")   as string | null;
  const paymentStatus = formData.get("payment_status") as string | null;

  if (!orderStatus || !VALID_ORDER_STATUSES.includes(orderStatus as ValidOrderStatus)) {
    return { success: false, error: "סטטוס הזמנה לא תקין" };
  }
  if (!paymentStatus || !VALID_PAYMENT_STATUSES.includes(paymentStatus as ValidPaymentStatus)) {
    return { success: false, error: "סטטוס תשלום לא תקין" };
  }

  const supabase = await createAdminClient();

  const { error } = await supabase
    .from("orders")
    .update({
      order_status:   orderStatus   as ValidOrderStatus,
      payment_status: paymentStatus as ValidPaymentStatus,
    })
    .eq("id", orderId);

  if (error) return { success: false, error: "שגיאה בעדכון הסטטוס" };

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  return { success: true };
}
