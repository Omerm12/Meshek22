import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isMissingObjectError,
  loadDashboardCounts,
  type CountsError,
} from "@/lib/admin/dashboard-counts";

/**
 * A stand-in for the Supabase service-role client, exposing only the `rpc` and
 * `from(...).select(...).eq(...)` surface the loader uses.
 */
interface StubOptions {
  rpcResult?: { data: unknown; error: CountsError | null };
  rpcThrows?: boolean;
  /** Per-table result. A table missing from the map behaves as not deployed. */
  tables?: Record<string, { count?: number; error?: CountsError }>;
  /** Per-order-status counts for the fallback path. */
  statusCounts?: Record<string, number | { error: CountsError }>;
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
        select() {
          const settled = (result: { count: number | null; error: CountsError | null }) =>
            Promise.resolve(result);

          const tableResult = () => {
            calls.push(`count:${table}`);
            const configured = options.tables?.[table];
            if (!configured) return settled({ count: null, error: MISSING_TABLE });
            if (configured.error) return settled({ count: null, error: configured.error });
            // `?? null` (not `?? 0`) so a test can reproduce the real
            // "no error, no count" response from a missing table.
            return settled({ count: configured.count ?? null, error: null });
          };

          const builder = {
            eq(column: string, value: string | boolean) {
              if (column === "order_status") {
                calls.push(`count:${table}:${value}`);
                const configured = options.statusCounts?.[String(value)];
                if (configured === undefined) return settled({ count: 0, error: null });
                if (typeof configured === "number") return settled({ count: configured, error: null });
                return settled({ count: null, error: configured.error });
              }
              return tableResult();
            },
            then<T>(onFulfilled: (v: { count: number | null; error: CountsError | null }) => T) {
              return tableResult().then(onFulfilled);
            },
          };

          return builder;
        },
      };
    },
  };

  return { client, calls };
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
  it("recognises a missing RPC and a missing table", () => {
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
  it("uses the RPC result and issues no table queries", async () => {
    const { client, calls } = makeStub({
      rpcResult: {
        error: null,
        data: {
          orders_pending_payment: 19,
          orders_confirmed: 3,
          orders_preparing: 1,
          orders_out_for_delivery: 1,
          products_active: 158,
          categories_active: 26,
          settlements: 61,
          delivery_zones: 2,
          promotions_active: 4,
        },
      },
    });

    const counts = await loadDashboardCounts(client);

    expect(counts.source).toBe("rpc");
    expect(counts.ordersByStatus.pending_payment).toBe(19);
    expect(counts.productsActive).toBe(158);
    expect(counts.settlements).toBe(61);
    expect(counts.promotionsActive).toBe(4);
    expect(counts.hasErrors).toBe(false);
    expect(counts.promotionsUnavailable).toBe(false);

    // The whole point of the RPC: one round-trip.
    expect(calls).toEqual(["rpc:admin_dashboard_counts"]);
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

  it("falls back to direct queries and reports real numbers", async () => {
    const { client } = makeStub({
      rpcResult: { data: null, error: MISSING_FUNCTION },
      tables: deployedTables,
      statusCounts: { pending_payment: 19, confirmed: 3, preparing: 1, out_for_delivery: 1 },
    });

    const counts = await loadDashboardCounts(client);

    expect(counts.source).toBe("fallback");
    expect(counts.ordersByStatus.pending_payment).toBe(19);
    expect(counts.ordersByStatus.preparing).toBe(1);
    expect(counts.productsActive).toBe(158);
    expect(counts.categoriesActive).toBe(26);
    expect(counts.settlements).toBe(61);
    expect(counts.deliveryZones).toBe(2);
    expect(counts.hasErrors).toBe(false);
  });

  it("also falls back when the RPC call throws outright", async () => {
    const { client } = makeStub({
      rpcThrows: true,
      tables: deployedTables,
      statusCounts: { pending_payment: 7 },
    });

    const counts = await loadDashboardCounts(client);
    expect(counts.source).toBe("fallback");
    expect(counts.ordersByStatus.pending_payment).toBe(7);
  });

  it("loads every core count even though the promotions table is missing", async () => {
    // This is today's production state: 20260808_002 has not been applied.
    const { client } = makeStub({
      rpcResult: { data: null, error: MISSING_FUNCTION },
      tables: {
        products: { count: 158 },
        categories: { count: 26 },
        settlements: { count: 61 },
        delivery_zones: { count: 2 },
        // promotions intentionally absent → PGRST205
      },
      statusCounts: { pending_payment: 19, preparing: 1, out_for_delivery: 1 },
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
    expect(counts.ordersByStatus.pending_payment).toBe(19);
  });

  it("keeps the other counts when one query fails unexpectedly", async () => {
    const { client } = makeStub({
      rpcResult: { data: null, error: MISSING_FUNCTION },
      tables: {
        products: { error: { code: "42501", message: "permission denied for table products" } },
        categories: { count: 26 },
        settlements: { count: 61 },
        delivery_zones: { count: 2 },
        promotions: { count: 0 },
      },
      statusCounts: { pending_payment: 19, confirmed: 2 },
    });

    const counts = await loadDashboardCounts(client);

    // The failed count is null, never a fabricated zero…
    expect(counts.productsActive).toBeNull();
    // …the rest still load…
    expect(counts.categoriesActive).toBe(26);
    expect(counts.settlements).toBe(61);
    expect(counts.ordersByStatus.pending_payment).toBe(19);
    // …and the dashboard is told to show its warning.
    expect(counts.hasErrors).toBe(true);
  });

  it("survives one order-status count failing", async () => {
    const { client } = makeStub({
      rpcResult: { data: null, error: MISSING_FUNCTION },
      tables: deployedTables,
      statusCounts: {
        pending_payment: { error: { code: "57014", message: "statement timeout" } },
        confirmed: 3,
        preparing: 1,
        out_for_delivery: 1,
      },
    });

    const counts = await loadDashboardCounts(client);

    expect(counts.ordersByStatus.pending_payment).toBeNull();
    expect(counts.ordersByStatus.confirmed).toBe(3);
    expect(counts.productsActive).toBe(158);
    expect(counts.hasErrors).toBe(true);
  });

  it("treats a null count with no error as unavailable, not as zero", async () => {
    // Observed against the live database: a head-only count on a table that does
    // not exist yet answers { count: null, error: null }. Rendering that as "0"
    // would be a convincing lie about an empty shop.
    const { client } = makeStub({
      rpcResult: { data: null, error: MISSING_FUNCTION },
      tables: {
        products: { count: 158 },
        categories: { count: 26 },
        settlements: { count: 61 },
        delivery_zones: { count: 2 },
        promotions: { count: undefined as unknown as number },
      },
      statusCounts: { pending_payment: 19 },
    });

    const counts = await loadDashboardCounts(client);

    expect(counts.promotionsActive).toBeNull();
    expect(counts.promotionsUnavailable).toBe(true);
    expect(counts.hasErrors).toBe(false);
    expect(counts.productsActive).toBe(158);
  });

  it("reports a genuine zero as zero, not as unavailable", async () => {
    // A brand-new shop with no orders and no products must not raise a warning.
    const { client } = makeStub({
      rpcResult: { data: null, error: MISSING_FUNCTION },
      tables: {
        products: { count: 0 },
        categories: { count: 0 },
        settlements: { count: 0 },
        delivery_zones: { count: 0 },
        promotions: { count: 0 },
      },
      statusCounts: { pending_payment: 0, confirmed: 0, preparing: 0, out_for_delivery: 0 },
    });

    const counts = await loadDashboardCounts(client);

    expect(counts.productsActive).toBe(0);
    expect(counts.ordersByStatus.pending_payment).toBe(0);
    expect(counts.hasErrors).toBe(false);
    expect(counts.promotionsUnavailable).toBe(false);
  });

  it("logs code, message, details and hint for an unexpected failure", async () => {
    const errorSpy = vi.spyOn(console, "error");
    const { client } = makeStub({
      rpcResult: { data: null, error: MISSING_FUNCTION },
      tables: {
        products: {
          error: {
            code: "42501",
            message: "permission denied",
            details: "role anon",
            hint: "grant select",
          },
        },
        categories: { count: 1 },
        settlements: { count: 1 },
        delivery_zones: { count: 1 },
        promotions: { count: 1 },
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
});
