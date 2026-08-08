/**
 * Reading orders for the admin panel, tolerant of an un-migrated database.
 *
 * `orders.fulfillment_method` arrives with migration 20260808_003. Until that is
 * applied, selecting it makes PostgREST reject the WHOLE query with 42703 — which
 * is why the order list and the order page were blank, not just the dashboard.
 *
 * So every read tries the full column set and, on a missing-column error, retries
 * without it. A pre-migration order is treated as a delivery order, which is what
 * it is: pickup did not exist when it was placed. The moment the migration lands
 * the first attempt succeeds and the fallback stops being used — no switch to flip.
 *
 * Kept out of the "use server" action file because that file may only export
 * async functions, and these constants and mappers are shared with the dashboard.
 */

import { isMissingObjectError, type CountsError } from "@/lib/admin/dashboard-counts";

/** Columns the list and dashboard render, once the schema is fully migrated. */
const ORDER_COLUMNS_FULL =
  "id, order_number, order_status, payment_status, fulfillment_method, payment_method, total_agorot, created_at, customer_snapshot";

/** Same, minus columns added by migrations that may not be applied yet. */
const ORDER_COLUMNS_LEGACY =
  "id, order_number, order_status, payment_status, payment_method, total_agorot, created_at, customer_snapshot";

export interface AdminOrderRow {
  id: string;
  order_number: string;
  order_status: string;
  payment_status: string;
  /** Normalised: NULL in the database (or column absent) becomes "delivery". */
  fulfillment_method: string;
  payment_method: string | null;
  total_agorot: number;
  created_at: string;
  customer_snapshot: unknown;
}

interface RawOrderRow {
  id: string;
  order_number: string;
  order_status: string;
  payment_status: string;
  fulfillment_method?: string | null;
  payment_method: string | null;
  total_agorot: number;
  created_at: string;
  customer_snapshot: unknown;
}

/**
 * Fill in what an older row cannot tell us.
 *
 * Pickup was introduced together with the column, so any row without it is a
 * delivery order. This keeps every downstream label and transition rule working
 * on historical orders instead of special-casing them everywhere.
 */
export function normalizeOrderRow(raw: RawOrderRow): AdminOrderRow {
  return {
    id: raw.id,
    order_number: raw.order_number,
    order_status: raw.order_status,
    payment_status: raw.payment_status,
    fulfillment_method: raw.fulfillment_method ?? "delivery",
    payment_method: raw.payment_method ?? null,
    total_agorot: raw.total_agorot,
    created_at: raw.created_at,
    customer_snapshot: raw.customer_snapshot,
  };
}

interface QueryResult {
  data: unknown;
  error: CountsError | null;
}

/**
 * A narrowed view of the Supabase query builder.
 *
 * `select()` is typed to parse its column list as a string literal so it can
 * infer the row shape. Passing a column list chosen at runtime — which is the
 * whole point of the schema fallback — sends that inference into a recursion
 * TypeScript gives up on (TS2589). Narrowing to the handful of methods actually
 * used keeps the fallback possible and confines the cast to this one place.
 */
export interface OrdersQueryBuilder extends PromiseLike<QueryResult> {
  order(column: string, options?: { ascending?: boolean }): OrdersQueryBuilder;
  limit(count: number): OrdersQueryBuilder;
  eq(column: string, value: string | number | boolean): OrdersQueryBuilder;
  in(column: string, values: readonly string[]): OrdersQueryBuilder;
  or(filter: string): OrdersQueryBuilder;
  maybeSingle(): PromiseLike<QueryResult>;
}

interface SupabaseLike {
  from(table: string): unknown;
}

/** Start an `orders` query with a runtime column list. */
export function ordersTable(db: SupabaseLike): { select(columns: string): OrdersQueryBuilder } {
  return db.from("orders") as { select(columns: string): OrdersQueryBuilder };
}

/**
 * Run a read with the full column list, falling back to the legacy list when a
 * column is not deployed yet.
 *
 * `build` is called once per attempt because a PostgREST query builder cannot be
 * re-executed after it has been awaited.
 */
export async function selectOrdersWithFallback(
  build: (columns: string) => PromiseLike<QueryResult>
): Promise<{ rows: AdminOrderRow[]; error: CountsError | null; usedLegacySchema: boolean }> {
  const first = await build(ORDER_COLUMNS_FULL);

  if (!first.error) {
    return {
      rows: (first.data as RawOrderRow[] | null ?? []).map(normalizeOrderRow),
      error: null,
      usedLegacySchema: false,
    };
  }

  if (!isMissingObjectError(first.error)) {
    console.error("[admin:orders] query failed", {
      code: first.error.code,
      message: first.error.message,
      details: first.error.details,
      hint: first.error.hint,
    });
    return { rows: [], error: first.error, usedLegacySchema: false };
  }

  console.warn("[admin:orders] fulfillment_method not deployed yet, reading legacy columns", {
    code: first.error.code,
  });

  const second = await build(ORDER_COLUMNS_LEGACY);

  if (second.error) {
    console.error("[admin:orders] legacy query failed", {
      code: second.error.code,
      message: second.error.message,
      details: second.error.details,
      hint: second.error.hint,
    });
    return { rows: [], error: second.error, usedLegacySchema: true };
  }

  return {
    rows: (second.data as RawOrderRow[] | null ?? []).map(normalizeOrderRow),
    error: null,
    usedLegacySchema: true,
  };
}

export { ORDER_COLUMNS_FULL, ORDER_COLUMNS_LEGACY };

// ─── Order detail ─────────────────────────────────────────────────────────────

const DETAIL_BASE = `
  id, order_number, order_status, payment_status, payment_method, payment_reference,
  subtotal_agorot, delivery_fee_agorot, discount_agorot, total_agorot,
  customer_snapshot, delivery_address_snapshot, delivery_notes,
  requested_delivery_date, confirmed_delivery_date, created_at, updated_at
`;

/** Full detail select, including everything the 20260808 migrations add. */
const ORDER_DETAIL_COLUMNS_FULL = `
  ${DETAIL_BASE}, fulfillment_method, discount_breakdown,
  order_items ( id, quantity, unit_price_agorot, total_price_agorot, discount_agorot, promotion_snapshot, product_snapshot )
`;

/** Detail select limited to columns that exist before those migrations. */
const ORDER_DETAIL_COLUMNS_LEGACY = `
  ${DETAIL_BASE},
  order_items ( id, quantity, unit_price_agorot, total_price_agorot, product_snapshot )
`;

export interface AdminOrderItem {
  id: string;
  quantity: number;
  unit_price_agorot: number;
  total_price_agorot: number;
  discount_agorot: number;
  promotion_snapshot: { name?: string } | null;
  product_snapshot: unknown;
}

export interface AdminOrderDetail {
  id: string;
  order_number: string;
  order_status: string;
  payment_status: string;
  payment_method: string | null;
  payment_reference: string | null;
  /** Normalised — "delivery" when the column is absent or NULL. */
  fulfillment_method: string;
  subtotal_agorot: number;
  delivery_fee_agorot: number;
  discount_agorot: number;
  discount_breakdown: { name?: string; groups_applied?: number; discount_agorot?: number }[];
  total_agorot: number;
  customer_snapshot: unknown;
  delivery_address_snapshot: unknown;
  delivery_notes: string | null;
  requested_delivery_date: string | null;
  confirmed_delivery_date: string | null;
  created_at: string;
  updated_at: string;
  order_items: AdminOrderItem[];
}

interface RawDetailRow extends Omit<AdminOrderDetail, "fulfillment_method" | "discount_breakdown" | "order_items"> {
  fulfillment_method?: string | null;
  discount_breakdown?: unknown;
  order_items?: (Omit<AdminOrderItem, "discount_agorot" | "promotion_snapshot"> & {
    discount_agorot?: number | null;
    promotion_snapshot?: { name?: string } | null;
  })[];
}

function normalizeDetail(raw: RawDetailRow): AdminOrderDetail {
  return {
    ...raw,
    fulfillment_method: raw.fulfillment_method ?? "delivery",
    discount_breakdown: Array.isArray(raw.discount_breakdown)
      ? (raw.discount_breakdown as AdminOrderDetail["discount_breakdown"])
      : [],
    order_items: (raw.order_items ?? []).map((item) => ({
      ...item,
      // Pre-migration rows have no per-line discount, which is correct: group
      // promotions did not exist when they were placed.
      discount_agorot: item.discount_agorot ?? 0,
      promotion_snapshot: item.promotion_snapshot ?? null,
    })),
  };
}

/**
 * Read one order for the detail page, degrading to the legacy column set when
 * the newer columns are not deployed. Returns null when the order genuinely
 * does not exist, so the caller can render notFound().
 */
export async function selectOrderDetailWithFallback(
  build: (columns: string) => PromiseLike<QueryResult>
): Promise<AdminOrderDetail | null> {
  const first = await build(ORDER_DETAIL_COLUMNS_FULL);

  if (!first.error) {
    const row = first.data as RawDetailRow | null;
    return row ? normalizeDetail(row) : null;
  }

  if (!isMissingObjectError(first.error)) {
    console.error("[admin:orders] detail query failed", {
      code: first.error.code,
      message: first.error.message,
      details: first.error.details,
      hint: first.error.hint,
    });
    return null;
  }

  console.warn("[admin:orders] detail falling back to legacy columns", {
    code: first.error.code,
  });

  const second = await build(ORDER_DETAIL_COLUMNS_LEGACY);
  if (second.error) {
    console.error("[admin:orders] legacy detail query failed", {
      code: second.error.code,
      message: second.error.message,
    });
    return null;
  }

  const row = second.data as RawDetailRow | null;
  return row ? normalizeDetail(row) : null;
}
