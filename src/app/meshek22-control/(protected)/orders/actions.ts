"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { ADMIN_BASE_PATH } from "@/lib/admin/routes";
import {
  BUCKET_STATUSES,
  isOperationalBucket,
  isPaymentStatus,
} from "@/lib/admin/order-presentation";
import {
  actionRequiresCashConfirmation,
  isTransitionAction,
  resolveTransition,
  type TransitionAction,
} from "@/lib/admin/order-transitions";
import {
  ordersTable,
  selectOrdersWithFallback,
  type AdminOrderRow,
} from "@/lib/admin/orders-data";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OrderRow = AdminOrderRow;

export interface OrderPageFilters {
  search?: string;
  /** Operational bucket key (attention | new | preparing | ready | completed | cancelled). */
  status?: string;
  payment?: string;
}

export interface OrderPageResult {
  orders: OrderRow[];
  nextCursor: string | null;
  /** True when the read failed outright, so the UI can say so instead of showing "no orders". */
  failed: boolean;
}

const PAGE_SIZE = 15;

// ─── fetchOrdersPage ──────────────────────────────────────────────────────────

export async function fetchOrdersPage(
  cursor: string | null,
  filters: OrderPageFilters
): Promise<OrderPageResult> {
  await requireAdmin();

  const supabase = createAdminClient();
  const term = filters.search?.trim().toLowerCase() ?? "";

  // Text search is applied in the application, so cursor pagination is disabled
  // while searching to avoid paging over a partially-filtered set.
  const usingTextSearch = !!term;

  const { rows, error } = await selectOrdersWithFallback((columns) => {
    let query = ordersTable(supabase)
      .select(columns)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });

    if (!usingTextSearch) query = query.limit(PAGE_SIZE + 1);

    // Operational bucket → the underlying enum values it covers.
    if (filters.status && isOperationalBucket(filters.status)) {
      const statuses = BUCKET_STATUSES[filters.status];
      query = statuses.length === 1
        ? query.eq("order_status", statuses[0])
        : query.in("order_status", statuses);
    }

    if (filters.payment && isPaymentStatus(filters.payment)) {
      query = query.eq("payment_status", filters.payment);
    }

    if (!usingTextSearch && cursor) {
      const [cursorDate, cursorId] = cursor.split("|");
      if (cursorDate && cursorId) {
        query = query.or(
          `created_at.lt.${cursorDate},and(created_at.eq.${cursorDate},id.lt.${cursorId})`
        );
      }
    }

    return query;
  });

  if (error) return { orders: [], nextCursor: null, failed: true };

  const filtered = term
    ? rows.filter((o) => {
        const c = o.customer_snapshot as { name?: string; phone?: string } | null;
        return (
          o.order_number.toLowerCase().includes(term) ||
          c?.name?.toLowerCase().includes(term) ||
          (c?.phone ?? "").includes(term)
        );
      })
    : rows;

  if (usingTextSearch) {
    return { orders: filtered, nextCursor: null, failed: false };
  }

  const hasMore = filtered.length > PAGE_SIZE;
  const orders = hasMore ? filtered.slice(0, PAGE_SIZE) : filtered;
  const last = orders[orders.length - 1];

  return {
    orders,
    nextCursor: hasMore && last ? `${last.created_at}|${last.id}` : null,
    failed: false,
  };
}

// ─── Order workflow transition ────────────────────────────────────────────────

export type ActionResult = { success: true } | { success: false; error: string };

/**
 * Advance an order one step through the workflow.
 *
 * This replaces the two free-form status dropdowns. Security does not depend on
 * which buttons were rendered:
 *
 *   1. requireAdmin() — the action is a plain HTTP endpoint, reachable without
 *      the page ever rendering.
 *   2. The order is re-read from the database; nothing about its state is taken
 *      from the client.
 *   3. resolveTransition() checks the request against the explicit allowlist,
 *      including payment method and fulfillment method.
 *   4. A CardCom order can never be marked paid here — only the verified webhook.
 *   5. The UPDATE carries a compare-and-set on the status the transition expected,
 *      so if two admins click at once the second one changes nothing and is told
 *      the order moved on.
 */
export async function applyOrderTransition(
  orderId: string,
  action: string,
  options?: { cashReceived?: boolean }
): Promise<ActionResult> {
  await requireAdmin();

  if (!isTransitionAction(action)) {
    return { success: false, error: "פעולה לא מוכרת." };
  }
  const transitionAction: TransitionAction = action;

  const supabase = createAdminClient();

  // Re-read the order. The client's idea of the current state is irrelevant.
  const { rows, error: readError } = await selectOrdersWithFallback((columns) =>
    ordersTable(supabase).select(columns).eq("id", orderId).limit(1)
  );

  if (readError) {
    return { success: false, error: "שגיאה בטעינת ההזמנה. נסו שוב." };
  }

  const order = rows[0];
  if (!order) {
    return { success: false, error: "ההזמנה לא נמצאה." };
  }

  const ctx = {
    orderStatus: order.order_status,
    paymentStatus: order.payment_status,
    paymentMethod: order.payment_method,
    fulfillmentMethod: order.fulfillment_method,
  };

  const resolved = resolveTransition(transitionAction, ctx);
  if (!resolved.ok) {
    return { success: false, error: resolved.error };
  }

  // Settling cash requires the admin to have actually confirmed it.
  if (actionRequiresCashConfirmation(transitionAction, ctx) && !options?.cashReceived) {
    return {
      success: false,
      error: "יש לאשר שהתקבל התשלום במזומן לפני סימון ההזמנה כהושלמה.",
    };
  }

  const update: Record<string, string> = {
    order_status: resolved.nextOrderStatus,
    updated_at: new Date().toISOString(),
  };
  if (resolved.nextPaymentStatus) {
    update.payment_status = resolved.nextPaymentStatus;
  }

  // Compare-and-set: only applies while the order is still in the state the
  // transition was resolved against.
  const { data: updated, error: updateError } = await supabase
    .from("orders")
    .update(update)
    .eq("id", orderId)
    .eq("order_status", resolved.expectedOrderStatus)
    .select("id");

  if (updateError) {
    console.error("[admin:orders] transition update failed", {
      orderId,
      action: transitionAction,
      code: updateError.code,
      message: updateError.message,
      details: updateError.details,
      hint: updateError.hint,
    });
    return { success: false, error: "שגיאה בעדכון ההזמנה. נסו שוב." };
  }

  if (!updated || updated.length === 0) {
    // Someone else moved the order between the read and the write.
    return {
      success: false,
      error: "סטטוס ההזמנה השתנה בינתיים. רעננו את הדף ונסו שוב.",
    };
  }

  revalidatePath(ADMIN_BASE_PATH);
  revalidatePath(`${ADMIN_BASE_PATH}/orders`);
  revalidatePath(`${ADMIN_BASE_PATH}/orders/${orderId}`);

  return { success: true };
}
