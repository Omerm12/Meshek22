/**
 * Dashboard counters, with a fallback for a database that has not had the
 * newest migrations applied yet.
 *
 * `admin_dashboard_counts` folds every count into one round-trip, but it only
 * exists once migration 20260808_004 has run. Until then PostgREST answers
 * PGRST202 ("could not find the function"), and the dashboard used to treat that
 * as "everything is zero" — showing an empty shop with 158 products in it.
 *
 * So: try the RPC, and if it is absent (or predates the current card layout),
 * count directly instead. Every fallback query runs concurrently and is isolated,
 * so one missing table — today, `promotions` — cannot blank the other counts.
 * The RPC path starts working again by itself once the migration is applied.
 *
 * A count that fails for an unexpected reason is reported as `null`, never as
 * `0`. A real zero and a failed query must not look the same to the shop owner.
 */

import {
  BUCKET_RULES,
  ORDER_STATUS_VALUES,
  isPickupOrder,
  type OperationalBucket,
  type OrderStatusValue,
} from "@/lib/admin/order-presentation";
import {
  EXCLUDE_INCOMPLETE_CARDCOM,
  ordersTable,
  selectOrdersWithFallback,
} from "@/lib/admin/orders-data";
import {
  isMissingObjectError as isMissingObject,
  type PostgrestErrorLike,
} from "@/lib/admin/postgrest-errors";

export type { PostgrestErrorLike as CountsError } from "@/lib/admin/postgrest-errors";

type CountsError = PostgrestErrorLike;

interface CountResponse {
  count: number | null;
  error: CountsError | null;
}

interface RpcResponse {
  data: unknown;
  error: CountsError | null;
}

/** Chainable count query, narrowed to what this module uses. */
interface CountQuery extends PromiseLike<CountResponse> {
  eq(column: string, value: string | boolean): CountQuery;
  or(filter: string): CountQuery;
}

/**
 * Structural type covering only what this module calls, so tests can supply a
 * small stub instead of a whole Supabase client.
 */
export interface CountsClient {
  rpc(fn: "admin_dashboard_counts"): PromiseLike<RpcResponse>;
  from(table: string): {
    select(columns: string, options: { count: "exact"; head: true }): CountQuery;
  };
}

export interface DashboardCounts {
  /**
   * Operational card counts, keyed by bucket. null = could not be determined
   * (never a fabricated zero). Incomplete CardCom attempts are excluded.
   */
  buckets: Record<OperationalBucket, number | null>;
  productsActive: number | null;
  categoriesActive: number | null;
  settlements: number | null;
  deliveryZones: number | null;
  /** null when the promotions table does not exist yet. */
  promotionsActive: number | null;
  /** Where the numbers came from — surfaced in logs, not in the UI. */
  source: "rpc" | "fallback";
  /** A core count failed unexpectedly; the UI shows a refresh warning. */
  hasErrors: boolean;
  /** promotions is simply not deployed yet — expected, not an error. */
  promotionsUnavailable: boolean;
}

/** Re-exported so existing callers and tests keep one import site. */
export const isMissingObjectError = isMissingObject;

/** Server-only diagnostics. Never returned to the browser. */
function logCountFailure(scope: string, error: CountsError): void {
  console.error("[admin:dashboard] count failed", {
    scope,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
}

function emptyBuckets(): Record<OperationalBucket, number | null> {
  return {
    awaiting_payment_call: null,
    new: null,
    preparing: null,
    out_for_delivery: null,
    ready_for_pickup: null,
    completed: null,
    cancelled: null,
  };
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// ─── RPC shape ────────────────────────────────────────────────────────────────

interface RpcCounts {
  orders_awaiting_payment_call?: number;
  orders_new?: number;
  orders_preparing?: number;
  orders_out_for_delivery?: number;
  orders_ready_for_pickup?: number;
  orders_completed?: number;
  orders_cancelled?: number;
  products_active?: number;
  categories_active?: number;
  settlements?: number;
  delivery_zones?: number;
  promotions_active?: number;
}

/**
 * The RPC is only usable if it speaks the current card vocabulary. An older
 * deployment returning per-status counts cannot express "phone-credit awaiting a
 * call" or the delivery/pickup split, so we fall back rather than mis-count.
 */
function rpcSupportsCurrentCards(payload: RpcCounts): boolean {
  return typeof payload.orders_awaiting_payment_call === "number";
}

function fromRpc(payload: RpcCounts): DashboardCounts {
  const promotionsActive = readNumber(payload.promotions_active);

  return {
    buckets: {
      awaiting_payment_call: readNumber(payload.orders_awaiting_payment_call),
      new:                   readNumber(payload.orders_new),
      preparing:             readNumber(payload.orders_preparing),
      out_for_delivery:      readNumber(payload.orders_out_for_delivery),
      ready_for_pickup:      readNumber(payload.orders_ready_for_pickup),
      completed:             readNumber(payload.orders_completed),
      cancelled:             readNumber(payload.orders_cancelled),
    },
    productsActive:   readNumber(payload.products_active),
    categoriesActive: readNumber(payload.categories_active),
    settlements:      readNumber(payload.settlements),
    deliveryZones:    readNumber(payload.delivery_zones),
    promotionsActive,
    source: "rpc",
    hasErrors: false,
    promotionsUnavailable: promotionsActive === null,
  };
}

// ─── Fallback ─────────────────────────────────────────────────────────────────

/** One isolated count. Resolves to null on failure rather than rejecting. */
async function safeCount(
  scope: string,
  run: () => PromiseLike<CountResponse>
): Promise<{ value: number | null; missing: boolean }> {
  try {
    const { count, error } = await run();
    if (error) {
      const missing = isMissingObjectError(error);
      if (!missing) logCountFailure(scope, error);
      else {
        console.warn("[admin:dashboard] object not deployed yet", {
          scope,
          code: error.code,
          message: error.message,
        });
      }
      return { value: null, missing };
    }
    if (count === null) {
      // A head-only count against a table PostgREST does not know about comes
      // back as { count: null, error: null } rather than as an error. Reporting
      // that as 0 would invent a believable number, so it is treated as
      // unavailable — which is exactly what it is.
      console.warn("[admin:dashboard] count returned no value", { scope });
      return { value: null, missing: true };
    }
    return { value: count, missing: false };
  } catch (thrown) {
    logCountFailure(scope, {
      message: thrown instanceof Error ? thrown.message : String(thrown),
    });
    return { value: null, missing: false };
  }
}

/** Count one bucket whose rule needs no fulfillment column. */
function countBucket(
  db: CountsClient,
  bucket: OperationalBucket
): Promise<{ value: number | null; missing: boolean }> {
  const rule = BUCKET_RULES[bucket];
  return safeCount(`orders:${bucket}`, () => {
    let q = db
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("order_status", rule.orderStatuses[0]);

    if (rule.paymentMethod) q = q.eq("payment_method", rule.paymentMethod);
    if (rule.paymentStatus) q = q.eq("payment_status", rule.paymentStatus);
    // Incomplete online-card attempts never belong on an operational card.
    // (Redundant when the rule already pins payment_method, harmless otherwise.)
    q = q.or(EXCLUDE_INCOMPLETE_CARDCOM);
    return q;
  });
}

/**
 * Delivery and pickup share one enum value and are split by a column that may
 * not exist yet, so they are counted by reading the (small) out_for_delivery set
 * and splitting it in memory, where a legacy row has already been normalised to
 * "delivery".
 */
async function countFulfillmentSplit(
  db: CountsClient
): Promise<{ delivery: number | null; pickup: number | null }> {
  try {
    const { rows, error } = await selectOrdersWithFallback((columns) =>
      ordersTable(db as unknown as { from(t: string): unknown })
        .select(columns)
        .eq("order_status", "out_for_delivery")
    );

    if (error) return { delivery: null, pickup: null };

    let delivery = 0;
    let pickup = 0;
    for (const row of rows) {
      const ctx = {
        orderStatus: row.order_status,
        paymentStatus: row.payment_status,
        paymentMethod: row.payment_method,
        fulfillmentMethod: row.fulfillment_method,
      };
      if (ctx.paymentMethod === "credit_card" && ctx.paymentStatus !== "paid") continue;
      if (isPickupOrder(ctx)) pickup += 1;
      else delivery += 1;
    }
    return { delivery, pickup };
  } catch (thrown) {
    logCountFailure("orders:fulfillment_split", {
      message: thrown instanceof Error ? thrown.message : String(thrown),
    });
    return { delivery: null, pickup: null };
  }
}

/** Count every table directly. Used when the RPC is not deployed. */
async function loadFallbackCounts(db: CountsClient): Promise<DashboardCounts> {
  // All independent — issued together, each isolated from the others.
  const [
    awaitingCall,
    newOrders,
    preparing,
    split,
    products,
    categories,
    settlements,
    deliveryZones,
    promotions,
  ] = await Promise.all([
    countBucket(db, "awaiting_payment_call"),
    countBucket(db, "new"),
    countBucket(db, "preparing"),
    countFulfillmentSplit(db),
    safeCount("products", () =>
      db.from("products").select("id", { count: "exact", head: true }).eq("is_active", true)
    ),
    safeCount("categories", () =>
      db.from("categories").select("id", { count: "exact", head: true }).eq("is_active", true)
    ),
    safeCount("settlements", () =>
      db.from("settlements").select("id", { count: "exact", head: true })
    ),
    safeCount("delivery_zones", () =>
      db.from("delivery_zones").select("id", { count: "exact", head: true })
    ),
    safeCount("promotions", () =>
      db.from("promotions").select("id", { count: "exact", head: true })
    ),
  ]);

  const buckets = emptyBuckets();
  buckets.awaiting_payment_call = awaitingCall.value;
  buckets.new = newOrders.value;
  buckets.preparing = preparing.value;
  buckets.out_for_delivery = split.delivery;
  buckets.ready_for_pickup = split.pickup;

  // The promotions table not existing yet is expected and must not raise the
  // warning banner; anything else failing must.
  const coreFailed =
    awaitingCall.value === null ||
    newOrders.value === null ||
    preparing.value === null ||
    split.delivery === null ||
    products.value === null ||
    categories.value === null ||
    settlements.value === null ||
    deliveryZones.value === null;

  return {
    buckets,
    productsActive:   products.value,
    categoriesActive: categories.value,
    settlements:      settlements.value,
    deliveryZones:    deliveryZones.value,
    promotionsActive: promotions.value,
    source: "fallback",
    hasErrors: coreFailed || (promotions.value === null && !promotions.missing),
    promotionsUnavailable: promotions.value === null,
  };
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * @param client A Supabase service-role client, or any object with the same
 *   `rpc` / `from` surface (see CountsClient).
 *
 *   Typed as `unknown` on purpose: checking the real client against CountsClient
 *   makes TypeScript walk the generated table generics and give up with TS2589.
 *   The cast is safe in practice because every call below is wrapped — a method
 *   that is missing or throws is handled as a failed count, not a crash.
 */
export async function loadDashboardCounts(client: unknown): Promise<DashboardCounts> {
  const db = client as CountsClient;

  let rpc: RpcResponse;
  try {
    rpc = await db.rpc("admin_dashboard_counts");
  } catch (thrown) {
    rpc = {
      data: null,
      error: { message: thrown instanceof Error ? thrown.message : String(thrown) },
    };
  }

  if (!rpc.error && rpc.data && typeof rpc.data === "object") {
    const payload = rpc.data as RpcCounts;
    if (rpcSupportsCurrentCards(payload)) return fromRpc(payload);
    console.warn("[admin:dashboard] counts RPC predates the current cards, counting directly");
  }

  if (rpc.error) {
    if (isMissingObjectError(rpc.error)) {
      // Expected until migration 20260808_004 is applied.
      console.warn("[admin:dashboard] counts RPC not deployed, using direct queries", {
        code: rpc.error.code,
        message: rpc.error.message,
      });
    } else {
      logCountFailure("admin_dashboard_counts", rpc.error);
    }
  }

  return loadFallbackCounts(db);
}

/** Exported for tests that assert the full status vocabulary is covered. */
export const ALL_ORDER_STATUSES: readonly OrderStatusValue[] = ORDER_STATUS_VALUES;
