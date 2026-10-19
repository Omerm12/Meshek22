"use server";

import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { withAdminTiming } from "@/lib/admin/instrumentation";
import {
  formatDateOnlyDisplay,
  formatIsraelNow,
  israelDateRangeToUtc,
  parseDateOnly,
} from "@/lib/utils/israel-time";
import { buildSalesReportForRange } from "@/lib/admin/reports-data";
import type { SalesReport } from "@/lib/admin/sales-report";
import { BUSINESS_IDENTITY } from "@/lib/config/business";

export interface GeneratedReport {
  report: SalesReport;
  business: { name: string; taxId: string | null };
  filterFromDisplay: string;
  filterToDisplay: string;
  generatedAtDisplay: string;
}

export type GenerateReportResult =
  | { success: true; data: GeneratedReport }
  | { success: false; error: string };

/**
 * Produces the full website sales report for an Israel calendar date range.
 *
 * Re-checks authorization itself (requireAdmin()) rather than trusting the
 * page having rendered — this is reachable directly as a Server Action, the
 * same reasoning every other admin mutation/read in this codebase follows
 * (see applyOrderTransition in orders/actions.ts).
 *
 * The inclusion rule is enforced entirely inside
 * fetchPaidOrdersInRange/buildSalesReportForRange: payment_status = "paid",
 * filtered by orders.created_at in Asia/Jerusalem — order/fulfillment
 * status never enters the query or the aggregation at all.
 */
export async function generateSalesReport(
  fromDate: string,
  toDate: string
): Promise<GenerateReportResult> {
  await requireAdmin();

  const from = parseDateOnly(fromDate);
  const to = parseDateOnly(toDate);
  if (!from || !to) {
    return { success: false, error: "יש לבחור תאריך התחלה ותאריך סיום תקינים." };
  }

  const { startUtc: fromStart } = israelDateRangeToUtc(from, from);
  const { startUtc: toStart } = israelDateRangeToUtc(to, to);
  if (toStart.getTime() < fromStart.getTime()) {
    return { success: false, error: "תאריך הסיום חייב להיות אחרי תאריך ההתחלה (או זהה לו)." };
  }

  const supabase = createAdminClient();

  const { report, error } = await withAdminTiming(
    "admin:reports:sales",
    () => buildSalesReportForRange(supabase, { from, to }),
    (result) => ({ failed: !!result.error, groupCount: result.report?.groups.length ?? 0 })
  );

  if (error || !report) {
    return { success: false, error: "שגיאה בטעינת נתוני ההזמנות. נסו שוב." };
  }

  return {
    success: true,
    data: {
      report,
      business: BUSINESS_IDENTITY,
      filterFromDisplay: formatDateOnlyDisplay(from),
      filterToDisplay: formatDateOnlyDisplay(to),
      generatedAtDisplay: formatIsraelNow(),
    },
  };
}
