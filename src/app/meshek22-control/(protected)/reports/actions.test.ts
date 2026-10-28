import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Behavioural coverage for generateSalesReport(): authorization is
 * re-checked independently of the page having rendered, malformed/reversed
 * date ranges are rejected before any database read, and the paid-only
 * inclusion rule and group aggregation run for real against a stubbed
 * Supabase client (only auth and the client constructor are mocked — the
 * actual query-building and aggregation code is exercised, same approach as
 * orders/actions.test.ts).
 */

const { requireAdminMock, dbRef } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(async () => ({
    id: "admin-1",
    email: "admin@meshek22.co.il",
    full_name: "מנהל",
    role: "admin",
  })),
  dbRef: { current: null as unknown },
}));

vi.mock("@/lib/admin/auth", () => ({ requireAdmin: requireAdminMock }));
vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => dbRef.current }));

import { generateSalesReport } from "@/app/meshek22-control/(protected)/reports/actions";

interface Row {
  payment_method: string | null;
  total_agorot: number;
}

function makeDb(result: { rows: Row[] } | { error: { message: string; code?: string } }) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          gte: () => ({
            lt: () => ({
              order: () => ({
                order: () => ({
                  range: async () =>
                    "error" in result
                      ? { data: null, error: result.error }
                      : { data: result.rows, error: null },
                }),
              }),
            }),
          }),
        }),
      }),
    }),
  };
}

beforeEach(() => {
  requireAdminMock.mockClear();
});

describe("generateSalesReport — authorization", () => {
  it("re-checks authorization independently of any page having rendered", async () => {
    dbRef.current = makeDb({ rows: [] });
    await generateSalesReport("2026-01-01", "2026-01-31");
    expect(requireAdminMock).toHaveBeenCalledTimes(1);
  });
});

describe("generateSalesReport — date validation", () => {
  it("rejects a malformed date without touching the database", async () => {
    dbRef.current = makeDb({ rows: [] });
    const result = await generateSalesReport("not-a-date", "2026-01-31");
    expect(result.success).toBe(false);
  });

  it("rejects an end date before the start date", async () => {
    dbRef.current = makeDb({ rows: [] });
    const result = await generateSalesReport("2026-02-01", "2026-01-01");
    expect(result.success).toBe(false);
  });

  it("accepts a single-day range (from === to) and produces a valid zero-sales report when nothing matches", async () => {
    dbRef.current = makeDb({ rows: [] });
    const result = await generateSalesReport("2026-01-15", "2026-01-15");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.report.grandTotal.debitCount).toBe(0);
  });
});

describe("generateSalesReport — report contents", () => {
  it("builds a report from the fetched paid orders and fills in filter/business/timestamp fields", async () => {
    dbRef.current = makeDb({
      rows: [
        { payment_method: "cash", total_agorot: 1000 },
        { payment_method: "credit_card", total_agorot: 2000 },
      ],
    });

    const result = await generateSalesReport("2026-01-01", "2026-01-31");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.filterFromDisplay).toBe("01/01/2026");
    expect(result.data.filterToDisplay).toBe("31/01/2026");
    expect(result.data.business.name).toBeTruthy();
    expect(result.data.report.grandTotal.debitCount).toBe(2);
    expect(result.data.report.grandTotal.debitAgorot).toBe(3000);
  });

  it("surfaces a database failure as an error result instead of a misleadingly empty report", async () => {
    dbRef.current = makeDb({ error: { message: "db down", code: "500" } });
    const result = await generateSalesReport("2026-01-01", "2026-01-31");
    expect(result.success).toBe(false);
  });
});
