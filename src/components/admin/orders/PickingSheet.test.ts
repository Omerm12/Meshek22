import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Structural checks for the picking-sheet print fix. There is no jsdom in
 * this project (see vitest.config.ts), so — consistent with the rest of the
 * suite — these assert on the component/CSS source for the properties that
 * actually caused the left-shifted, clipped print: an explicit @page box, a
 * fixed table layout with real column widths, and a quantity cell that stays
 * LTR and unwrapped regardless of the page's RTL direction.
 */
const component = readFileSync("src/components/admin/orders/PickingSheet.tsx", "utf8");
const shell = readFileSync("src/components/admin/AdminShell.tsx", "utf8");
const css = readFileSync("src/app/globals.css", "utf8");

describe("PickingSheet quantity rendering", () => {
  it("renders the quantity value unmodified — no rounding, truncation or reformatting", () => {
    expect(component).toMatch(/picking-sheet-qty[^>]*>\{item\.quantity\}/);
    // Guards against a future "cleanup" that reintroduces formatting.
    expect(component).not.toMatch(/item\.quantity\.toFixed/);
    expect(component).not.toMatch(/Math\.round\(item\.quantity/);
    expect(component).not.toMatch(/parseInt\(item\.quantity/);
  });

  it("gives the quantity column its own class for the print-only bidi/nowrap rules", () => {
    expect(component).toContain("picking-sheet-qty");
  });
});

describe("PickingSheet table structure", () => {
  it("declares explicit RTL-safe column widths via <colgroup>, not implicit sizing", () => {
    expect(component).toContain("<colgroup>");
    expect(component).toContain("picking-sheet-col-check");
    expect(component).toContain("picking-sheet-col-product");
    expect(component).toContain("picking-sheet-col-unit");
    expect(component).toContain("picking-sheet-col-qty");
  });

  it("uses the fixed-layout table class instead of Tailwind's implicit w-full/border-collapse", () => {
    expect(component).toMatch(/<table className="picking-sheet-table/);
  });
});

describe("Print CSS: @page and reset", () => {
  it("defines an explicit A4 portrait @page box with safety margins", () => {
    expect(css).toMatch(/@page\s*\{[^}]*size:\s*A4\s+portrait/);
    expect(css).toMatch(/@page\s*\{[^}]*margin:\s*12mm\s+14mm/);
  });

  it("resets html/body width and overflow for print instead of relying on browser defaults", () => {
    const printBlock = css.match(/@media print \{[\s\S]*?html, body \{([\s\S]*?)\}/);
    expect(printBlock).not.toBeNull();
    expect(printBlock![1]).toMatch(/width:\s*auto/);
    expect(printBlock![1]).toMatch(/overflow:\s*visible/);
  });

  it("never uses 100vw for the printed document", () => {
    const printSections = css.match(/@media print \{[\s\S]*?\n\}/g) ?? [];
    for (const section of printSections) {
      expect(section).not.toContain("100vw");
    }
  });
});

describe("Print CSS: table layout and quantity cell", () => {
  it("forces table-layout: fixed and border-collapse on the picking-sheet table", () => {
    const tableRule = css.match(/\.picking-sheet-table \{([\s\S]*?)\}/);
    expect(tableRule).not.toBeNull();
    expect(tableRule![1]).toMatch(/table-layout:\s*fixed/);
    expect(tableRule![1]).toMatch(/border-collapse:\s*collapse/);
    expect(tableRule![1]).toMatch(/max-width:\s*100%/);
  });

  it("keeps the quantity cell LTR, isolated, non-wrapping and bold", () => {
    const qtyRule = css.match(/\.picking-sheet-qty \{([\s\S]*?)\}/);
    expect(qtyRule).not.toBeNull();
    expect(qtyRule![1]).toMatch(/direction:\s*ltr/);
    expect(qtyRule![1]).toMatch(/unicode-bidi:\s*isolate/);
    expect(qtyRule![1]).toMatch(/white-space:\s*nowrap/);
    expect(qtyRule![1]).toMatch(/font-weight:\s*700/);
  });
});

describe("Print CSS: multi-page pagination", () => {
  it("repeats the table header on every printed page", () => {
    expect(css).toMatch(/\.picking-sheet thead \{\s*display:\s*table-header-group/);
  });

  it("prevents an order row from splitting across a page break (modern + legacy property)", () => {
    const trRule = css.match(/\.picking-sheet tr \{([\s\S]*?)\}/);
    expect(trRule).not.toBeNull();
    expect(trRule![1]).toMatch(/break-inside:\s*avoid/);
    expect(trRule![1]).toMatch(/page-break-inside:\s*avoid/);
  });
});

describe("Print CSS: admin shell chrome removal", () => {
  it("hides sidebar/header chrome unconditionally, not depending on utility-class cascade order", () => {
    expect(css).toMatch(/\[data-admin-chrome\] \{\s*display:\s*none\s*!important/);
  });

  it("resets the main content region to full width with no leftover shell padding", () => {
    const mainRule = css.match(/\[data-admin-main\] \{([\s\S]*?)\}/);
    expect(mainRule).not.toBeNull();
    expect(mainRule![1]).toMatch(/width:\s*100%\s*!important/);
    expect(mainRule![1]).toMatch(/padding:\s*0\s*!important/);
  });

  it("wires the print CSS hooks onto the actual sidebar, header and main elements", () => {
    expect(shell).toMatch(/data-admin-shell/);
    // Two chrome regions carry the JSX attribute: the sidebar wrapper and the
    // header (a third mention lives in an explanatory comment above them).
    expect(shell.match(/<[a-z]+\b[^>]*\bdata-admin-chrome\b/g) ?? []).toHaveLength(2);
    expect(shell).toMatch(/data-admin-main/);
  });
});
