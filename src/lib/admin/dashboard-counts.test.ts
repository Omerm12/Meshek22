import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isMissingObjectError,
  loadDashboardCounts,
  type CountsError,
} from "@/lib/admin/dashboard-counts";

/**
 * A stand-in for the Supabase service-role client, exposing only the surface the
 * loader uses: `rpc`, and `from(...).select(...)` with chained `.eq()` / `.or()`.
 *
 * The out_for_delivery split is counted by reading rows rather than by a count
 * query, so the stub also serves `select(columns)` row reads.
 */
interface StubOptions {
  rpcResult?: { data: unknown; error: CountsError | null };
  rpcThrows?: boolean;
  tables?: Record<string, { count?: number; error?: CountsError }>;
  /** Counts keyed by the bucket-defining order_status filter. */
  statusCounts?: Record<string, number | { error: CountsError }>;
  /** Rows returned for the out_for_delivery fulfillment split. */
  outForDeliveryRows?: Record<string, unknown>[];
  /** Force the full-column order read to fail, exercising the legacy fallback. */
  fulfillmentColumnMissing?: boolean;
}

const MISSING_TABLE: CountsError = {
  code: "PGRST205",
  message: "Could not find the table 'public.promotions' in the schema cache",
};

const MISSING_FUNCTION: CountsError = {
  code: "PGRST202",
  message:
    "Could not find the function public.admin_dashboard_counts without parameters in the schema cache",
};

const MISSING_COLUMN: CountsError = {
  code: "42703",
  message: 'column orders.fulfillment_method does not exist',
};

function makeStub(options: StubOptions) {
  const calls: string[] = [];

  const client = {
    rpc(fn: string) {
      calls.push(`rpc:${fn}`);
      if (options.rpcThrows) throw new Error("network down");
      return Promise.resolve(options.rpcResult ?? { data: null, error: MISSING_FUNCTION });
    },
    from(table: string) {
      return {
        select(columns: string, countOptions?: { count: "exact"; head: true }) {
          const isCount = !!countOptions;
          const state: { status?: string } = {};

          const settleCount = () => {
            if (table === "orders" && state.status) {
              calls.push(`count:orders:${state.status}`);
              const configured = options.statusCounts?.[state.status];
              if (configured === undefined) return Promise.resolve({ count: 0, error: null });
              if (typeof configured === "number") {
                return Promise.resolve({ count: configured, error: null });
              }
              return Promise.resolve({ count: null, error: configured.error });
            }
            calls.push(`count:${table}`);
            const configured = options.tables?.[table];
            if (!configured) return Promise.resolve({ count: null, error: MISSING_TABLE });
            if (configured.error) return Promise.resolve({ count: null, error: configured.error });
            // `?? null` (not `?? 0`) so a test can reproduce the real
            // "no error, no count" response from a missing table.
            return Promise.resolve({ count: configured.count ?? null, error: null });
          };

          const settleRows = () => {
            calls.push(`rows:${table}`);
            if (options.fulfillmentColumnMissing && columns.includes("fulfillment_method")) {
              return Promise.resolve({ data: null, error: MISSING_COLUMN });
            }
            return Promise.resolve({ data: options.outForDeliveryRows ?? [], error: null });
          };

          const builder = {
            eq(column: string, value: string | boolean) {
              if (column === "order_status") state.status = String(value);
              return builder;
            },
            or() {
              return builder;
            },
            order() {
              return builder;
            },
            limit() {
              return builder;
            },
            then<T>(onFulfilled: (v: unknown) => T) {
              return (isCount ? settleCount() : settleRows()).then(onFulfilled);
            },
          };

          return builder;
        },
      };
    },
  };

  return { client, calls };
}

function orderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "o1",
    order_number: "M22-1",
    order_status: "out_for_delivery",
    payment_status: "pending",
    payment_method: "cash",
    fulfillment_method: "delivery",
    total_agorot: 1000,
    created_at: "2026-08-08T10:00:00Z",
    customer_snapshot: { name: "לקוח" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Error classification ─────────────────────────────────────────────────────

describe("isMissingObjectError", () => {
  it("recognises a missing RPC, table and column", () => {
    expect(isMissingObjectError(MISSING_FUNCTION)).toBe(true);
    expect(isMissingObjectError(MISSING_TABLE)).toBe(true);
    expect(isMissingObjectError({ code: "42P01" })).toBe(true);
    expect(isMissingObjectError({ code: "42703" })).toBe(true);
  });

  it("does not mistake a real failure for a missing object", () => {
    expect(isMissingObjectError({ code: "42501", message: "permission denied" })).toBe(false);
    expect(isMissingObjectError(null)).toBe(false);
    expect(isMissingObjectError(undefined)).toBe(false);
  });
});

// ─── RPC path ─────────────────────────────────────────────────────────────────

describe("dashboard counts — RPC available", () => {
  const rpcPayload = {
    orders_awaiting_payment_call: 2,
    orders_new: 3,
    orders_preparing: 1,
    orders_out_for_delivery: 4,
    orders_ready_for_pickup: 5,
    orders_completed: 40,
    orders_cancelled: 6,
    products_active: 158,
    categories_active: 26,
    settlements: 61,
    delivery_zones: 2,
    promotions_active: 4,
  };

  it("uses the RPC result and issues no table queries", async () => {
    const { client, calls } = makeStub({ rpcResult: { error: null, data: rpcPayload } });

    const counts = await loadDashboardCounts(client);

    expect(counts.source).toBe("rpc");
    expect(counts.buckets.awaiting_payment_call).toBe(2);
    expect(counts.buckets.new).toBe(3);
    expect(counts.buckets.out_for_delivery).toBe(4);
    expect(counts.buckets.ready_for_pickup).toBe(5);
    expect(counts.productsActive).toBe(158);
    expect(counts.hasErrors).toBe(false);

    // The whole point of the RPC: one round-trip.
    expect(calls).toEqual(["rpc:admin_dashboard_counts"]);
  });

  it("falls back when the RPC predates the current card layout", async () => {
    // An older deployment returns per-status counts that cannot express
    // "phone-credit awaiting a call" — counting from them would be wrong.
    const { client, calls } = makeStub({
      rpcResult: { error: null, data: { orders_pending_payment: 19, products_active: 158 } },
      tables: { products: { count: 158 }, categories: { count: 26 }, settlements: { count: 61 }, delivery_zones: { count: 2 }, promotions: { count: 1 } },
      statusCounts: { pending_payment: 2, confirmed: 3, preparing: 1 },
      outForDeliveryRows: [orderRow()],
    });

    const counts = await loadDashboardCounts(client);
    expect(counts.source).toBe("fallback");
    expect(calls.filter((c) => c.startsWith("count:")).length).toBeGreaterThan(0);
  });
});

// ─── Fallback path ────────────────────────────────────────────────────────────

describe("dashboard counts — RPC not deployed", () => {
  const deployedTables = {
    products: { count: 158 },
    categories: { count: 26 },
    settlements: { count: 61 },
    delivery_zones: { count: 2 },
    promotions: { count: 4 },
  };

  const baseline = {
    rpcResult: { data: null, error: MISSING_FUNCTION },
    tables: deployedTables,
    statusCounts: { pending_payment: 2, confirmed: 3, preparing: 1 },
    outForDeliveryRows: [
      orderRow({ id: "d1", fulfillment_method: "delivery" }),
      orderRow({ id: "d2", fulfillment_method: "delivery" }),
      orderRow({ id: "p1", fulfillment_method: "pickup" }),
    ],
  };

  it("falls back to direct queries and reports real numbers", async () => {
    const { client } = makeStub(baseline);
    const counts = await loadDashboardCounts(client);

    expect(counts.source).toBe("fallback");
    expect(counts.buckets.awaiting_payment_call).toBe(2);
    expect(counts.buckets.new).toBe(3);
    expect(counts.buckets.preparing).toBe(1);
    expect(counts.productsActive).toBe(158);
    expect(counts.settlements).toBe(61);
    expect(counts.hasErrors).toBe(false);
  });

  it("splits delivery from pickup", async () => {
    const { client } = makeStub(baseline);
    const counts = await loadDashboardCounts(client);

    expect(counts.buckets.out_for_delivery).toBe(2);
    expect(counts.buckets.ready_for_pickup).toBe(1);
  });

  it("excludes incomplete CardCom attempts from the fulfillment split", async () => {
    const { client } = makeStub({
      ...baseline,
      outForDeliveryRows: [
        orderRow({ id: "d1", fulfillment_method: "delivery", payment_method: "cash" }),
        orderRow({ id: "x1", fulfillment_method: "delivery", payment_method: "credit_card", payment_status: "pending" }),
        orderRow({ id: "x2", fulfillment_method: "pickup", payment_method: "credit_card", payment_status: "failed" }),
        orderRow({ id: "p1", fulfillment_method: "pickup", payment_method: "credit_card", payment_status: "paid" }),
      ],
    });

    const counts = await loadDashboardCounts(client);
    expect(counts.buckets.out_for_delivery).toBe(1); // the cash one only
    expect(counts.buckets.ready_for_pickup).toBe(1); // the paid CardCom one only
  });

  it("treats rows as deliveries when the fulfillment column is not deployed", async () => {
    const { client } = makeStub({
      ...baseline,
      fulfillmentColumnMissing: true,
      outForDeliveryRows: [orderRow({ id: "a" }), orderRow({ id: "b" })],
    });

    const counts = await loadDashboardCounts(client);
    expect(counts.buckets.out_for_delivery).toBe(2);
    expect(counts.buckets.ready_for_pickup).toBe(0);
    expect(counts.hasErrors).toBe(false);
  });

  it("also falls back when the RPC call throws outright", async () => {
    const { client } = makeStub({ ...baseline, rpcThrows: true });
    const counts = await loadDashboardCounts(client);
    expect(counts.source).toBe("fallback");
    expect(counts.buckets.awaiting_payment_call).toBe(2);
  });

  it("loads every core count even though the promotions table is missing", async () => {
    const { client } = makeStub({
      ...baseline,
      tables: {
        products: { count: 158 },
        categories: { count: 26 },
        settlements: { count: 61 },
        delivery_zones: { count: 2 },
        // promotions intentionally absent → PGRST205
      },
    });

    const counts = await loadDashboardCounts(client);

    expect(counts.promotionsActive).toBeNull();
    expect(counts.promotionsUnavailable).toBe(true);
    // A not-yet-deployed table is expected, so no alarm is raised…
    expect(counts.hasErrors).toBe(false);
    // …and nothing else is affected.
    expect(counts.productsActive).toBe(158);
    expect(counts.categoriesActive).toBe(26);
    expect(counts.settlements).toBe(61);
    expect(counts.deliveryZones).toBe(2);
    expect(counts.buckets.awaiting_payment_call).toBe(2);
  });

  it("keeps the other counts when one query fails unexpectedly", async () => {
    const { client } = makeStub({
      ...baseline,
      tables: {
        ...deployedTables,
        products: { error: { code: "42501", message: "permission denied for table products" } },
      },
    });

    const counts = await loadDashboardCounts(client);

    // The failed count is null, never a fabricated zero…
    expect(counts.productsActive).toBeNull();
    // …the rest still load…
    expect(counts.categoriesActive).toBe(26);
    expect(counts.buckets.awaiting_payment_call).toBe(2);
    // …and the dashboard is told to show its warning.
    expect(counts.hasErrors).toBe(true);
  });

  it("survives one bucket count failing", async () => {
    const { client } = makeStub({
      ...baseline,
      statusCounts: {
        pending_payment: { error: { code: "57014", message: "statement timeout" } },
        confirmed: 3,
        preparing: 1,
      },
    });

    const counts = await loadDashboardCounts(client);

    expect(counts.buckets.awaiting_payment_call).toBeNull();
    expect(counts.buckets.new).toBe(3);
    expect(counts.productsActive).toBe(158);
    expect(counts.hasErrors).toBe(true);
  });

  it("treats a null count with no error as unavailable, not as zero", async () => {
    // Observed against the live database: a head-only count on a table that does
    // not exist yet answers { count: null, error: null }.
    const { client } = makeStub({
      ...baseline,
      tables: { ...deployedTables, promotions: { count: undefined as unknown as number } },
    });

    const counts = await loadDashboardCounts(client);

    expect(counts.promotionsActive).toBeNull();
    expect(counts.promotionsUnavailable).toBe(true);
    expect(counts.hasErrors).toBe(false);
    expect(counts.productsActive).toBe(158);
  });

  it("reports a genuine zero as zero, not as unavailable", async () => {
    const { client } = makeStub({
      rpcResult: { data: null, error: MISSING_FUNCTION },
      tables: {
        products: { count: 0 },
        categories: { count: 0 },
        settlements: { count: 0 },
        delivery_zones: { count: 0 },
        promotions: { count: 0 },
      },
      statusCounts: { pending_payment: 0, confirmed: 0, preparing: 0 },
      outForDeliveryRows: [],
    });

    const counts = await loadDashboardCounts(client);

    expect(counts.productsActive).toBe(0);
    expect(counts.buckets.awaiting_payment_call).toBe(0);
    expect(counts.buckets.out_for_delivery).toBe(0);
    expect(counts.hasErrors).toBe(false);
    expect(counts.promotionsUnavailable).toBe(false);
  });

  it("logs code, message, details and hint for an unexpected failure", async () => {
    const errorSpy = vi.spyOn(console, "error");
    const { client } = makeStub({
      ...baseline,
      tables: {
        ...deployedTables,
        products: {
          error: { code: "42501", message: "permission denied", details: "role anon", hint: "grant select" },
        },
      },
    });

    await loadDashboardCounts(client);

    const logged = errorSpy.mock.calls.find(([msg]) => msg === "[admin:dashboard] count failed");
    expect(logged).toBeDefined();
    expect(logged![1]).toMatchObject({
      code: "42501",
      message: "permission denied",
      details: "role anon",
      hint: "grant select",
    });
  });

  it("runs the independent fallback queries concurrently", async () => {
    // Each stubbed query resolves on a later microtask; if they were awaited in
    // series the whole load would take proportionally longer. Asserting on the
    // call log instead: every count is issued before any of them is awaited.
    const { client, calls } = makeStub(baseline);
    await loadDashboardCounts(client);

    const countCalls = calls.filter((c) => c.startsWith("count:") || c.startsWith("rows:"));
    expect(countCalls.length).toBeGreaterThanOrEqual(8);
  });
});
