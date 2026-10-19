import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Structural checks mirroring PickingSheet.test.ts's approach (no jsdom in
 * this project — see vitest.config.ts): asserting on component/CSS source
 * for the properties the report specification requires verbatim — exact
 * Hebrew labels, exact row order, and the print/PDF pagination hooks.
 */
const component = readFileSync("src/components/admin/reports/SalesReportView.tsx", "utf8");
const css = readFileSync("src/app/globals.css", "utf8");
const sidebar = readFileSync("src/components/admin/AdminSidebar.tsx", "utf8");
const routes = readFileSync("src/lib/admin/routes.ts", "utf8");

describe("SalesReportView — eight-row summary order", () => {
  it("declares the eight summary rows in the exact required order", () => {
    const order = [
      "מס תנועות זכות",
      'סה"כ זכות',
      "מס תנועות חובה",
      'סה"כ חובה',
      "TOTAL",
      "סגירת חשבון",
      "קבלת הקפה",
      'סה"כ תקבולים',
    ];
    const indices = order.map((label) => component.indexOf(label));
    expect(indices.every((i) => i !== -1)).toBe(true);
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1]);
    }
  });

  it("only the grand total's last row is visually emphasized in bold", () => {
    expect(component).toContain("emphasizeLast");
  });
});

describe("SalesReportView — required headings and labels", () => {
  // The group headings themselves ("[ 1 ] מזומן", etc.) are produced by
  // buildSalesReport() in sales-report.ts, not hardcoded here — see
  // sales-report.test.ts for those exact-string assertions. This component
  // only ever renders {group.heading} as given.
  it("renders each group's own heading, not a hardcoded one", () => {
    expect(component).toMatch(/\{group\.heading\}/);
  });

  it("prints the exact report title, with אתר replacing the POS report's קופה", () => {
    expect(component).toContain("דוח מכירות אתר - א.תשלום מרוכז (לפי קבוצות א.תשלום)");
  });

  it("prints the exact filter and grand-total section headings", () => {
    expect(component).toContain("מסננים");
    expect(component).toContain("תאריך יצירה:");
    expect(component).toContain('סה"כ לדוח');
  });

  it("never renders the POS report's literal 'null - null' placeholder", () => {
    expect(component).not.toMatch(/null\s*-\s*null/);
  });
});

describe("Print/PDF pagination hooks", () => {
  it("every pagination unit (header+filters, each group, grand total) carries .report-pdf-section", () => {
    const matches = component.match(/report-pdf-section/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });

  it("globals.css prevents a .report-pdf-section from splitting across a printed page", () => {
    const rule = css.match(/\.report-pdf-section \{([\s\S]*?)\}/);
    expect(rule).not.toBeNull();
    expect(rule![1]).toMatch(/break-inside:\s*avoid/);
    expect(rule![1]).toMatch(/page-break-inside:\s*avoid/);
  });
});

describe("Admin navigation", () => {
  it("routes.ts defines the reports route", () => {
    expect(routes).toContain("reports:");
    expect(routes).toContain("/reports`");
  });

  it("the sidebar links to it with the exact Hebrew label", () => {
    expect(sidebar).toContain("דוחות כספיים");
    expect(sidebar).toContain("ADMIN_ROUTES.reports");
  });
});
