"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { ADMIN_BASE_PATH } from "@/lib/admin/routes";
import {
  BUCKET_RULES,
  isOperationalBucket,
  isPaymentStatus,
} from "@/lib/admin/order-presentation";
import {
  actionRequiresCashConfirmation,
  isCardcomRecheckAction,
  isTransitionAction,
  resolveTransition,
  type TransitionAction,
} from "@/lib/admin/order-transitions";
import { recoverPaymentByOrderId } from "@/lib/payment/cardcomFinalize";
import {
  EXCLUDE_INCOMPLETE_CARDCOM,
  applyBucketRule,
  buildOrderSearchFilter,
  filterRows,
  ordersTable,
  selectOrdersWithFallback,
  type AdminOrderRow,
} from "@/lib/admin/orders-data";
import { withAdminTiming } from "@/lib/admin/instrumentation";

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

// 20–30 is the recommended range for the admin order list; 20 keeps the
// common case (no filters) to one round-trip per screen of results.
const PAGE_SIZE = 20;

// ─── fetchOrdersPage ──────────────────────────────────────────────────────────

export async function fetchOrdersPage(
  cursor: string | null,
  filters: OrderPageFilters
): Promise<OrderPageResult> {
  await requireAdmin();

  const supabase = createAdminClient();
  const term = filters.search?.trim() ?? "";
  const bucket = filters.status && isOperationalBucket(filters.status) ? filters.status : null;

  // Every constraint — including the search term — is pushed into Postgres and
  // the result is capped with .limit(), so a search never downloads more than
  // one page's worth of rows, no matter how large the orders table grows.
  const { rows, error } = await withAdminTiming(
    "admin:orders:list",
    () =>
      selectOrdersWithFallback((columns) => {
        let query = ordersTable(supabase)
          .select(columns)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(PAGE_SIZE + 1);

        // Incomplete online-card attempts are never part of the employee
        // workflow, including in the default "הכול" view and in search results.
        query = query.or(EXCLUDE_INCOMPLETE_CARDCOM);

        // Status + payment constraints go to the database; the fulfillment half
        // of a bucket rule is applied in memory (see filterRows) because the
        // column may not exist yet.
        if (bucket) query = applyBucketRule(query, BUCKET_RULES[bucket]);

        if (filters.payment && isPaymentStatus(filters.payment)) {
          query = query.eq("payment_status", filters.payment);
        }

        if (term) query = query.or(buildOrderSearchFilter(term));

        if (cursor) {
          const [cursorDate, cursorId] = cursor.split("|");
          if (cursorDate && cursorId) {
            query = query.or(
              `created_at.lt.${cursorDate},and(created_at.eq.${cursorDate},id.lt.${cursorId})`
            );
          }
        }

        return query;
      }),
    ({ rows, error }) => ({
      resultCount: rows.length,
      hasSearch: !!term,
      bucket: bucket ?? "all",
      hasCursor: !!cursor,
      failed: !!error,
    })
  );

  if (error) return { orders: [], nextCursor: null, failed: true };

  // Second pass: enforce the whole rule, including the parts SQL could not.
  const visible = filterRows(rows, { bucket });

  const hasMore = visible.length > PAGE_SIZE;
  const orders = hasMore ? visible.slice(0, PAGE_SIZE) : visible;
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

  // ── CardCom recheck: not a CAS write, delegate to the verified pipeline ────
  //
  // Asks CardCom directly via the exact same verifyAndFinalizeCardcomPayment
  // path the webhook uses (through recoverPaymentByOrderId, which reads the
  // stored payment_reference). This never marks an order paid on its own
  // authority — it can only surface what CardCom itself reports, with the same
  // idempotent CAS guarding the write. Safe to click repeatedly.
  if (isCardcomRecheckAction(transitionAction)) {
    if (ctx.paymentMethod !== "credit_card") {
      return { success: false, error: "בדיקה מול קארדקום זמינה רק להזמנות בתשלום אשראי באתר." };
    }
    if (ctx.paymentStatus === "paid") {
      return { success: false, error: "ההזמנה כבר מסומנת כשולמה." };
    }

    const result = await recoverPaymentByOrderId(orderId);

    revalidatePath(ADMIN_BASE_PATH);
    revalidatePath(`${ADMIN_BASE_PATH}/orders`);
    revalidatePath(`${ADMIN_BASE_PATH}/orders/${orderId}`);

    switch (result.outcome) {
      case "paid":
      case "already_paid":
        return { success: true };
      case "failed":
        return { success: false, error: "חברת האשראי דיווחה שהתשלום נדחה." };
      case "blocked":
        return { success: false, error: "לא ניתן לאמת את התשלום מול קארדקום כרגע." };
      case "transient_error":
        return { success: false, error: "שגיאה זמנית בתקשורת עם קארדקום. נסו שוב בעוד רגע." };
    }
  }

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
