/**
 * Dashboard counters, with a fallback for a database that has not had the
 * newest migrations applied yet.
 *
 * `admin_dashboard_counts` folds nine counts into one round-trip, but it only
 * exists once migration 20260808_004 has run. Until then PostgREST answers
 * PGRST202 ("could not find the function"), and the dashboard used to treat that
 * as "everything is zero" — showing an empty shop with 158 products in it.
 *
 * So: try the RPC, and if it is genuinely absent, count the tables directly.
 * Each count is isolated with Promise.allSettled, so one missing table (today,
 * `promotions`) cannot blank the other eight. The RPC path starts working again
 * by itself the moment the migration is applied — nothing to switch over.
 *
 * A count that fails for an unexpected reason is reported as `null`, never as
 * `0`. A real zero and a failed query must not look the same to the shop owner.
 */

import { ORDER_STATUS_VALUES, type OrderStatusValue } from "@/lib/admin/order-presentation";

/** The subset of a PostgREST error this module reasons about. */
export interface CountsError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

interface CountResponse {
  count: number | null;
  error: CountsError | null;
}

interface RpcResponse {
  data: unknown;
  error: CountsError | null;
}

/**
 * Structural type covering only what this module calls, so tests can supply a
 * small stub instead of a whole Supabase client.
 */
export interface CountsClient {
  rpc(fn: "admin_dashboard_counts"): PromiseLike<RpcResponse>;
  from(table: string): {
    select(
      columns: string,
      options: { count: "exact"; head: true }
    ): PromiseLike<CountResponse> & {
      eq(column: string, value: string | boolean): PromiseLike<CountResponse>;
    };
  };
}

export interface DashboardCounts {
  /** null = this count could not be determined (never a fabricated zero). */
  ordersByStatus: Record<OrderStatusValue, number | null>;
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

/**
 * Postgres / PostgREST codes that mean "this object does not exist yet",
 * i.e. a migration has not been applied — as opposed to a real failure.
 */
const MISSING_OBJECT_CODES = new Set([
  "PGRST202", // function not found in schema cache
  "PGRST205", // table not found in schema cache
  "42883",    // undefined_function
  "42P01",    // undefined_table
  "42703",    // undefined_column
]);

export function isMissingObjectError(error: CountsError | null | undefined): boolean {
  if (!error) return false;
  if (error.code && MISSING_OBJECT_CODES.has(error.code)) return true;
  // Some PostgREST builds report the condition only in the message.
  const message = error.message ?? "";
  return /could not find the (function|table)/i.test(message);
}

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

function emptyOrdersByStatus(): Record<OrderStatusValue, number | null> {
  return Object.fromEntries(ORDER_STATUS_VALUES.map((s) => [s, null])) as Record<
    OrderStatusValue,
    number | null
  >;
}

// ─── RPC shape ────────────────────────────────────────────────────────────────

interface RpcCounts {
  orders_pending_payment?: number;
  orders_confirmed?: number;
  orders_preparing?: number;
  orders_out_for_delivery?: number;
  products_active?: number;
  categories_active?: number;
  settlements?: number;
  delivery_zones?: number;
  promotions_active?: number;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function fromRpc(payload: RpcCounts): DashboardCounts {
  const ordersByStatus = emptyOrdersByStatus();
  ordersByStatus.pending_payment  = readNumber(payload.orders_pending_payment);
  ordersByStatus.confirmed        = readNumber(payload.orders_confirmed);
  ordersByStatus.preparing        = readNumber(payload.orders_preparing);
  ordersByStatus.out_for_delivery = readNumber(payload.orders_out_for_delivery);

  const promotionsActive = readNumber(payload.promotions_active);

  return {
    ordersByStatus,
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
      // A missing table is an expected, reportable state — not a fault to shout
      // about on every dashboard render.
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

/**
 * Count every table directly. Used when the RPC is not deployed.
 *
 * The statuses shown on the dashboard are counted individually so that one
 * unavailable count cannot take the rest with it.
 */
async function loadFallbackCounts(db: CountsClient): Promise<DashboardCounts> {
  const dashboardStatuses: OrderStatusValue[] = [
    "pending_payment",
    "confirmed",
    "preparing",
    "out_for_delivery",
  ];

  const statusTasks = dashboardStatuses.map((status) =>
    safeCount(`orders:${status}`, () =>
      db.from("orders").select("id", { count: "exact", head: true }).eq("order_status", status)
    ).then((result) => ({ status, ...result }))
  );

  const [
    statusResults,
    products,
    categories,
    settlements,
    deliveryZones,
    promotions,
  ] = await Promise.all([
    Promise.all(statusTasks),
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

  const ordersByStatus = emptyOrdersByStatus();
  for (const { status, value } of statusResults) {
    ordersByStatus[status] = value;
  }

  // The promotions table not existing yet is expected and must not raise the
  // warning banner; anything else failing must.
  const coreFailed =
    statusResults.some((r) => r.value === null) ||
    products.value === null ||
    categories.value === null ||
    settlements.value === null ||
    deliveryZones.value === null;

  return {
    ordersByStatus,
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
    return fromRpc(rpc.data as RpcCounts);
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
