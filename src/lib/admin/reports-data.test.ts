import { describe, expect, it } from "vitest";
import { buildSalesReportForRange, fetchPaidOrdersInRange } from "./reports-data";
import type { PaidOrderRow } from "./sales-report";

/**
 * Minimal stub matching ReportsOrdersClient's exact chain shape
 * (.from("orders").select().eq().gte().lt().order().range()), recording
 * every filter argument and serving one page of rows per call to .range(),
 * in call order — same approach as orders/actions.test.ts's makeDb().
 */
function makeClient(
  pages: (PaidOrderRow[] | { error: { message: string; code?: string } })[]
) {
  const rangeCalls: [number, number][] = [];
  const filters: Record<string, unknown>[] = [];

  return {
    rangeCalls,
    filters,
    from(table: string) {
      if (table !== "orders") throw new Error(`unexpected table in test stub: ${table}`);
      return {
        select: (columns: string) => {
          filters.push({ select: columns });
          return {
            eq: (col: string, val: string) => {
              filters.push({ eq: [col, val] });
              return {
                gte: (col2: string, val2: string) => {
                  filters.push({ gte: [col2, val2] });
                  return {
                    lt: (col3: string, val3: string) => {
                      filters.push({ lt: [col3, val3] });
                      return {
                        order: () => ({
                          range: async (from: number, to: number) => {
                            rangeCalls.push([from, to]);
                            const page = pages[rangeCalls.length - 1] ?? [];
                            if (!Array.isArray(page)) return { data: null, error: page.error };
                            return { data: page, error: null };
                          },
                        }),
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

const RANGE = {
  from: { year: 2026, month: 1, day: 1 },
  to: { year: 2026, month: 1, day: 31 },
};

describe("fetchPaidOrdersInRange — filters", () => {
  it("filters on payment_status = paid and the created_at date range, nothing else", async () => {
    const client = makeClient([[]]);
    await fetchPaidOrdersInRange(client, RANGE);

    expect(client.filters).toContainEqual({ eq: ["payment_status", "paid"] });
    const gte = client.filters.find((f) => "gte" in f) as { gte: [string, string] };
    const lt = client.filters.find((f) => "lt" in f) as { lt: [string, string] };
    expect(gte.gte[0]).toBe("created_at");
    expect(lt.lt[0]).toBe("created_at");
    // Order status never enters this query at all — the inclusion rule is
    // payment_status alone.
    expect(client.filters.some((f) => JSON.stringify(f).includes("order_status"))).toBe(false);
  });
});

describe("fetchPaidOrdersInRange — pagination", () => {
  it("returns all rows from a single, non-full page in one round trip", async () => {
    const rows: PaidOrderRow[] = [{ payment_method: "cash", total_agorot: 100 }];
    const client = makeClient([rows]);

    const result = await fetchPaidOrdersInRange(client, RANGE);

    expect(result.error).toBeNull();
    expect(result.rows).toEqual(rows);
    expect(client.rangeCalls).toEqual([[0, 999]]);
  });

  it("paginates through multiple full pages without truncating the result", async () => {
    const fullPage: PaidOrderRow[] = Array.from({ length: 1000 }, () => ({
      payment_method: "cash",
      total_agorot: 1,
    }));
    const lastPage: PaidOrderRow[] = [{ payment_method: "credit_card", total_agorot: 500 }];
    const client = makeClient([fullPage, fullPage, lastPage]);

    const result = await fetchPaidOrdersInRange(client, RANGE);

    expect(result.error).toBeNull();
    expect(result.rows).toHaveLength(2001);
    expect(client.rangeCalls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("stops and reports an error instead of returning a partial result when a page fails", async () => {
    const fullPage: PaidOrderRow[] = Array.from({ length: 1000 }, () => ({
      payment_method: "cash",
      total_agorot: 1,
    }));
    const client = makeClient([fullPage, { error: { message: "boom", code: "500" } }]);

    const result = await fetchPaidOrdersInRange(client, RANGE);

    expect(result.error).toBe("boom");
    expect(result.rows).toEqual([]);
  });

  it("an empty range (no matching orders) yields a valid empty result, not an error", async () => {
    const client = makeClient([[]]);
    const result = await fetchPaidOrdersInRange(client, RANGE);
    expect(result.error).toBeNull();
    expect(result.rows).toEqual([]);
  });
});

describe("buildSalesReportForRange", () => {
  it("builds a report from the fetched rows", async () => {
    const client = makeClient([
      [
        { payment_method: "cash", total_agorot: 1000 },
        { payment_method: "credit_card", total_agorot: 2000 },
      ],
    ]);

    const { report, error } = await buildSalesReportForRange(client, RANGE);

    expect(error).toBeNull();
    expect(report?.grandTotal.debitCount).toBe(2);
    expect(report?.grandTotal.debitAgorot).toBe(3000);
  });

  it("propagates a fetch error instead of returning a built-but-wrong report", async () => {
    const client = makeClient([{ error: { message: "boom" } }]);
    const { report, error } = await buildSalesReportForRange(client, RANGE);
    expect(report).toBeNull();
    expect(error).toBe("boom");
  });
});
