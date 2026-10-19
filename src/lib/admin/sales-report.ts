/**
 * Website sales report: pure aggregation from paid orders into the POS-style
 * payment-group structure (see the report specification for the exact
 * section layout this mirrors).
 *
 * Deliberately pure and dependency-free — no Supabase, no Next.js — so the
 * numbers that actually land on the printed report can be unit tested
 * directly against known inputs, independent of the database layer
 * (src/lib/admin/reports-data.ts) that feeds it.
 *
 * Inclusion rule (enforced by the caller, not here): only orders with
 * payment_status = "paid" are ever passed in. Order/fulfillment status has
 * no bearing on this module at all — it never even sees that column.
 */

export interface PaidOrderRow {
  /** Null only for historical rows that predate this column. */
  payment_method: string | null;
  /** Integer agorot — the order's final, actually-paid amount. */
  total_agorot: number;
}

export interface ReportDetailRow {
  /** The system's own internal code for this payment method (not a POS code — none exists here). */
  code: string;
  name: string;
  creditCount: number;
  creditAgorot: number;
  debitCount: number;
  debitAgorot: number;
  totalAgorot: number;
}

export interface ReportSummary {
  creditCount: number;
  creditAgorot: number;
  debitCount: number;
  debitAgorot: number;
  totalAgorot: number;
  /**
   * "סגירת חשבון" / "קבלת הקפה": concepts from the physical cash register
   * (running tabs) that this website has no equivalent of and keeps no
   * record of. null — never a fabricated zero — renders as "לא זמין".
   */
  accountClosingAgorot: number | null;
  creditCollectionAgorot: number | null;
  totalReceiptsAgorot: number;
}

export interface ReportGroup {
  key: string;
  /** e.g. "[ 1 ] מזומן" — printed verbatim. */
  heading: string;
  rows: ReportDetailRow[];
  summary: ReportSummary;
}

export interface SalesReport {
  groups: ReportGroup[];
  grandTotal: ReportSummary;
}

function detailRow(code: string, name: string, count: number, agorot: number): ReportDetailRow {
  return {
    code,
    name,
    // Ordinary successful website sales are never classified as זכות
    // (credit/reversal) movements — there is no reliable transaction record
    // of refunds or reversals to justify doing so (refunded orders are
    // already excluded upstream by the paid-only filter). Preserving this
    // convention is an explicit requirement, not an oversight.
    creditCount: 0,
    creditAgorot: 0,
    debitCount: count,
    debitAgorot: agorot,
    totalAgorot: agorot,
  };
}

function summarizeRows(rows: ReportDetailRow[]): ReportSummary {
  const creditCount = rows.reduce((sum, row) => sum + row.creditCount, 0);
  const creditAgorot = rows.reduce((sum, row) => sum + row.creditAgorot, 0);
  const debitCount = rows.reduce((sum, row) => sum + row.debitCount, 0);
  const debitAgorot = rows.reduce((sum, row) => sum + row.debitAgorot, 0);
  const totalAgorot = debitAgorot - creditAgorot;

  return {
    creditCount,
    creditAgorot,
    debitCount,
    debitAgorot,
    totalAgorot,
    accountClosingAgorot: null,
    creditCollectionAgorot: null,
    // Not debit + account-closing + credit-collection: those two are
    // genuinely untracked (null), not zero, so folding them in would turn
    // "unavailable" into a silently wrong number instead of an honest one.
    totalReceiptsAgorot: totalAgorot,
  };
}

/** Hebrew label for a payment method this site records but the POS structure has no fixed section for. */
const ADDITIONAL_METHOD_LABELS: Record<string, string> = {
  phone_credit: "אשראי טלפוני",
};

function labelForAdditionalMethod(method: string | null): string {
  if (method === null) return "לא צוין אמצעי תשלום";
  return ADDITIONAL_METHOD_LABELS[method] ?? `אחר (${method})`;
}

/**
 * Builds the full report from already paid-filtered, date-range-filtered
 * order rows (see fetchPaidOrdersInRange in reports-data.ts).
 *
 * Groups 1–3 (cash, checks, credit cards) always appear, matching the fixed
 * POS section structure — checks stays all-zero whenever (as today) the
 * site has no check payment method. Any other payment_method actually
 * present among the paid orders — phone_credit, a legacy value, or a
 * genuinely missing method — gets its own additional group rather than
 * being folded into cash or credit cards or silently dropped.
 */
export function buildSalesReport(paidOrders: readonly PaidOrderRow[]): SalesReport {
  let cashCount = 0;
  let cashAgorot = 0;
  let cardCount = 0;
  let cardAgorot = 0;
  const additional = new Map<string, { method: string | null; count: number; agorot: number }>();

  for (const order of paidOrders) {
    switch (order.payment_method) {
      case "cash":
        cashCount += 1;
        cashAgorot += order.total_agorot;
        break;
      case "credit_card":
        cardCount += 1;
        cardAgorot += order.total_agorot;
        break;
      default: {
        const key = order.payment_method ?? "\u0000unspecified";
        const entry = additional.get(key) ?? { method: order.payment_method, count: 0, agorot: 0 };
        entry.count += 1;
        entry.agorot += order.total_agorot;
        additional.set(key, entry);
      }
    }
  }

  const cashRows = [detailRow("cash", "מזומן", cashCount, cashAgorot)];
  const checksRows = [detailRow("—", "המחאות", 0, 0)];
  // No per-issuer card-company data is recorded anywhere in this codebase
  // (see src/lib/payment/cardcom-brands.ts) — a single consolidated row is
  // the only truthful option, never a guessed breakdown by card company.
  const cardRows = [detailRow("credit_card", "אשראי — לא מסווג לפי חברת כרטיס", cardCount, cardAgorot)];

  const groups: ReportGroup[] = [
    { key: "cash", heading: "[ 1 ] מזומן", rows: cashRows, summary: summarizeRows(cashRows) },
    { key: "checks", heading: "[ 2 ] המחאות", rows: checksRows, summary: summarizeRows(checksRows) },
    { key: "credit_card", heading: "[ 3 ] כרטיסי אשראי", rows: cardRows, summary: summarizeRows(cardRows) },
  ];

  let nextGroupNumber = 4;
  for (const { method, count, agorot } of additional.values()) {
    const label = labelForAdditionalMethod(method);
    const rows = [detailRow(method ?? "unspecified", label, count, agorot)];
    groups.push({
      key: `additional:${method ?? "unspecified"}`,
      heading: `[ ${nextGroupNumber} ] ${label}`,
      rows,
      summary: summarizeRows(rows),
    });
    nextGroupNumber += 1;
  }

  const grandTotal = summarizeRows(groups.flatMap((group) => group.rows));

  return { groups, grandTotal };
}

// ─── Formatting ───────────────────────────────────────────────────────────────

/** Two decimal places, thousands-separated — the report's one fixed numeric format. */
export function formatReportAmount(agorot: number): string {
  return (agorot / 100).toLocaleString("he-IL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Same as formatReportAmount, but renders an untracked (not zero) figure as "לא זמין". */
export function formatOptionalReportAmount(agorot: number | null): string {
  return agorot === null ? "לא זמין" : formatReportAmount(agorot);
}
