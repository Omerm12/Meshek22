/**
 * Reading paid orders for the website sales report.
 *
 * Unlike src/lib/admin/orders-data.ts, this needs no legacy/full column-set
 * fallback: payment_status, payment_method, total_agorot and created_at are
 * all present since the orders table's original schema (see
 * src/types/database.ts), not added by one of the pending 20260808
 * migrations.
 *
 * Paginates through the full date range in fixed-size pages via .range()
 * instead of a single .limit() call, so an arbitrarily large reporting
 * period is never silently truncated by PostgREST's own per-request row cap
 * (1000 rows, independent of any .limit() requested) — see spec section 9,
 * "Do not silently truncate report calculations due to database pagination
 * limits."
 */

import { israelDateRangeToUtc, type DateOnly } from "@/lib/utils/israel-time";
import { buildSalesReport, type PaidOrderRow, type SalesReport } from "@/lib/admin/sales-report";

const PAGE_SIZE = 1000;

interface RangeResponse {
  data: PaidOrderRow[] | null;
  error: { message: string; code?: string } | null;
}

/**
 * Structural type covering only the one query shape this module issues, so
 * tests can supply a small stub instead of a whole Supabase client — same
 * pattern as OrdersQueryBuilder in orders-data.ts and CountsClient in
 * dashboard-counts.ts.
 */
export interface ReportsOrdersClient {
  from(table: "orders"): {
    select(columns: string): {
      eq(column: string, value: string): {
        gte(column: string, value: string): {
          lt(column: string, value: string): {
            order(column: string, opts: { ascending: boolean }): {
              range(from: number, to: number): PromiseLike<RangeResponse>;
            };
          };
        };
      };
    };
  };
}

export interface FetchPaidOrdersResult {
  rows: PaidOrderRow[];
  /** Set when a page failed to load — the caller must not present a partial report as complete. */
  error: string | null;
}

/**
 * Reads every paid order created inside the given Israel calendar date
 * range, across as many pages as needed. Stops and reports an error rather
 * than silently returning a partial, misleadingly "complete-looking" report
 * — see spec section 6: "Never create an accounting document that looks
 * complete while silently omitting transactions."
 *
 * @param client A Supabase service-role client, or any object with the same
 *   `from` surface (see ReportsOrdersClient). Typed as `unknown` on purpose:
 *   checking the real generated client against ReportsOrdersClient makes
 *   TypeScript walk the generated table generics for a runtime-chosen
 *   argument and give up (TS2589) — the same reasoning documented on
 *   loadDashboardCounts in dashboard-counts.ts. The cast is safe in practice
 *   because every call below is awaited and its error is handled explicitly.
 */
export async function fetchPaidOrdersInRange(
  client: unknown,
  range: { from: DateOnly; to: DateOnly }
): Promise<FetchPaidOrdersResult> {
  const db = client as ReportsOrdersClient;
  const { startUtc, endUtc } = israelDateRangeToUtc(range.from, range.to);

  const rows: PaidOrderRow[] = [];
  let offset = 0;

  // Bounded by the data itself: each iteration only continues when the
  // previous page came back completely full, so this terminates as soon as
  // a page has fewer than PAGE_SIZE rows (including the very first, empty
  // range).
  for (;;) {
    const { data, error } = await db
      .from("orders")
      .select("payment_method, total_agorot")
      .eq("payment_status", "paid")
      .gte("created_at", startUtc.toISOString())
      .lt("created_at", endUtc.toISOString())
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error("[admin:reports] paid-orders query failed", {
        code: error.code,
        message: error.message,
        offset,
      });
      return { rows: [], error: error.message };
    }

    const page = data ?? [];
    rows.push(...page);

    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return { rows, error: null };
}

export interface BuildReportResult {
  report: SalesReport | null;
  error: string | null;
}

export async function buildSalesReportForRange(
  client: unknown,
  range: { from: DateOnly; to: DateOnly }
): Promise<BuildReportResult> {
  const { rows, error } = await fetchPaidOrdersInRange(client, range);
  if (error) return { report: null, error };
  return { report: buildSalesReport(rows), error: null };
}
