import { describe, expect, it } from "vitest";
import {
  buildSalesReport,
  formatOptionalReportAmount,
  formatReportAmount,
  type PaidOrderRow,
} from "./sales-report";

function order(payment_method: string | null, total_agorot: number): PaidOrderRow {
  return { payment_method, total_agorot };
}

describe("buildSalesReport — grouping", () => {
  it("groups cash orders into group 1 and sums their amounts into one row", () => {
    const report = buildSalesReport([order("cash", 1000), order("cash", 2550)]);
    const cash = report.groups.find((g) => g.key === "cash")!;
    expect(cash.heading).toBe("[ 1 ] מזומן");
    expect(cash.rows).toHaveLength(1);
    expect(cash.rows[0].debitCount).toBe(2);
    expect(cash.rows[0].debitAgorot).toBe(3550);
  });

  it("groups credit_card orders into a single consolidated row — no guessed issuer breakdown", () => {
    const report = buildSalesReport([order("credit_card", 5000), order("credit_card", 1500)]);
    const card = report.groups.find((g) => g.key === "credit_card")!;
    expect(card.heading).toBe("[ 3 ] כרטיסי אשראי");
    expect(card.rows).toHaveLength(1);
    expect(card.rows[0].name).toBe("אשראי — לא מסווג לפי חברת כרטיס");
    expect(card.rows[0].debitCount).toBe(2);
    expect(card.rows[0].debitAgorot).toBe(6500);
  });

  it("always includes a zeroed checks group, even with no check orders in the data", () => {
    const report = buildSalesReport([order("cash", 1000)]);
    const checks = report.groups.find((g) => g.key === "checks")!;
    expect(checks.heading).toBe("[ 2 ] המחאות");
    expect(checks.rows[0].debitCount).toBe(0);
    expect(checks.rows[0].debitAgorot).toBe(0);
  });

  it("an empty order list still produces the three fixed groups, fully zeroed", () => {
    const report = buildSalesReport([]);
    expect(report.groups.map((g) => g.key)).toEqual(["cash", "checks", "credit_card"]);
    expect(report.grandTotal.debitCount).toBe(0);
    expect(report.grandTotal.totalReceiptsAgorot).toBe(0);
  });

  it("puts phone_credit orders in their own additional group, never inside cash or credit cards", () => {
    const report = buildSalesReport([order("cash", 1000), order("phone_credit", 4000)]);
    const cash = report.groups.find((g) => g.key === "cash")!;
    expect(cash.rows[0].debitCount).toBe(1);

    const additional = report.groups.find((g) => g.key === "additional:phone_credit");
    expect(additional).toBeDefined();
    expect(additional!.heading).toBe("[ 4 ] אשראי טלפוני");
    expect(additional!.rows[0].debitCount).toBe(1);
    expect(additional!.rows[0].debitAgorot).toBe(4000);
  });

  it("buckets a null or unrecognised payment method into its own labeled additional group instead of dropping it", () => {
    const report = buildSalesReport([order(null, 999), order("card_mock", 500)]);

    const unspecified = report.groups.find((g) => g.key === "additional:unspecified");
    expect(unspecified).toBeDefined();
    expect(unspecified!.rows[0].debitCount).toBe(1);
    expect(unspecified!.rows[0].name).toBe("לא צוין אמצעי תשלום");

    const legacy = report.groups.find((g) => g.key === "additional:card_mock");
    expect(legacy).toBeDefined();
    expect(legacy!.rows[0].debitCount).toBe(1);
    expect(legacy!.rows[0].name).toContain("card_mock");
  });

  it("no group ever contains a different group's payment method", () => {
    const report = buildSalesReport([order("cash", 100), order("credit_card", 200), order("phone_credit", 300)]);
    const cash = report.groups.find((g) => g.key === "cash")!;
    const card = report.groups.find((g) => g.key === "credit_card")!;
    const checks = report.groups.find((g) => g.key === "checks")!;

    expect(cash.rows[0].debitAgorot).toBe(100);
    expect(card.rows[0].debitAgorot).toBe(200);
    expect(checks.rows[0].debitAgorot).toBe(0);
  });
});

describe("buildSalesReport — eight-row summary", () => {
  it("every group's summary carries all eight required fields", () => {
    const report = buildSalesReport([order("cash", 1000)]);
    for (const group of report.groups) {
      expect(typeof group.summary.creditCount).toBe("number");
      expect(typeof group.summary.creditAgorot).toBe("number");
      expect(typeof group.summary.debitCount).toBe("number");
      expect(typeof group.summary.debitAgorot).toBe("number");
      expect(typeof group.summary.totalAgorot).toBe("number");
      expect(typeof group.summary.totalReceiptsAgorot).toBe("number");
      // Untracked by this website — null (not a fabricated zero).
      expect(group.summary.accountClosingAgorot).toBeNull();
      expect(group.summary.creditCollectionAgorot).toBeNull();
    }
  });

  it("the grand-total section also carries all eight fields", () => {
    const report = buildSalesReport([order("cash", 1000), order("credit_card", 2000)]);
    expect(report.grandTotal.accountClosingAgorot).toBeNull();
    expect(report.grandTotal.creditCollectionAgorot).toBeNull();
    expect(report.grandTotal.debitCount).toBe(2);
  });

  it("ordinary successful sales are always classified under חובה, never זכות", () => {
    const report = buildSalesReport([order("cash", 1000), order("credit_card", 2000)]);
    for (const group of report.groups) {
      expect(group.summary.creditCount).toBe(0);
      expect(group.summary.creditAgorot).toBe(0);
    }
    expect(report.grandTotal.creditCount).toBe(0);
    expect(report.grandTotal.creditAgorot).toBe(0);
  });

  it('TOTAL and סה"כ תקבולים both equal the debit total when there is no credit movement', () => {
    const report = buildSalesReport([order("cash", 1234)]);
    const cash = report.groups.find((g) => g.key === "cash")!;
    expect(cash.summary.totalAgorot).toBe(1234);
    expect(cash.summary.totalReceiptsAgorot).toBe(1234);
  });
});

describe("buildSalesReport — reconciliation", () => {
  it("the grand total's debit sums equal the sum of every group's debit sums", () => {
    const orders = [order("cash", 1000), order("credit_card", 2000), order("phone_credit", 500), order(null, 250)];
    const report = buildSalesReport(orders);

    const sumDebitCount = report.groups.reduce((sum, g) => sum + g.summary.debitCount, 0);
    const sumDebitAgorot = report.groups.reduce((sum, g) => sum + g.summary.debitAgorot, 0);

    expect(report.grandTotal.debitCount).toBe(sumDebitCount);
    expect(report.grandTotal.debitAgorot).toBe(sumDebitAgorot);
    expect(report.grandTotal.debitCount).toBe(orders.length);
    expect(report.grandTotal.debitAgorot).toBe(1000 + 2000 + 500 + 250);
    expect(report.grandTotal.totalReceiptsAgorot).toBe(report.grandTotal.debitAgorot);
  });
});

describe("formatReportAmount / formatOptionalReportAmount", () => {
  it("always renders exactly two decimal places with thousands separators", () => {
    expect(formatReportAmount(8302160)).toBe("83,021.60");
    expect(formatReportAmount(0)).toBe("0.00");
  });

  it("renders a null (untracked) figure as לא זמין, never as a fabricated zero", () => {
    expect(formatOptionalReportAmount(null)).toBe("לא זמין");
    expect(formatOptionalReportAmount(0)).toBe("0.00");
  });
});
