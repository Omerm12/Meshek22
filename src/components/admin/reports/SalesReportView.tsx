/**
 * The printable website sales report — the actual document handed to the
 * accountant. Deliberately plain black-and-white and table-driven (spec:
 * "This is an accounting report, not an analytics dashboard"), and built
 * from fixed `.report-pdf-section` blocks:
 *
 *   - section 0: business header + "מסננים" filter line
 *   - one section per payment group (heading + detail table + 8-row summary)
 *   - last section: "סה"כ לדוח" grand total
 *
 * Each block is a print/PDF pagination unit — see globals.css's
 * `.report-pdf-section { break-inside: avoid }` for the browser-print path,
 * and ReportPdfButton for the html2canvas/jsPDF path that packs these same
 * blocks onto pages without ever cutting one in half. Keeping both paths
 * keyed off the identical section boundaries is what guarantees neither one
 * can split an eight-row summary across a page on its own, independently of
 * the other.
 */

import type { GeneratedReport } from "@/app/meshek22-control/(protected)/reports/actions";
import type { ReportGroup, ReportSummary } from "@/lib/admin/sales-report";
import { formatOptionalReportAmount, formatReportAmount } from "@/lib/admin/sales-report";

const SUMMARY_ROWS: { key: keyof ReportSummary; label: string }[] = [
  { key: "creditCount", label: 'מס תנועות זכות' },
  { key: "creditAgorot", label: 'סה"כ זכות' },
  { key: "debitCount", label: 'מס תנועות חובה' },
  { key: "debitAgorot", label: 'סה"כ חובה' },
  { key: "totalAgorot", label: "TOTAL" },
  { key: "accountClosingAgorot", label: "סגירת חשבון" },
  { key: "creditCollectionAgorot", label: "קבלת הקפה" },
  { key: "totalReceiptsAgorot", label: 'סה"כ תקבולים' },
];

function summaryValue(summary: ReportSummary, key: keyof ReportSummary): string {
  const value = summary[key];
  if (key === "creditCount" || key === "debitCount") {
    return (value as number).toLocaleString("he-IL");
  }
  if (key === "accountClosingAgorot" || key === "creditCollectionAgorot") {
    return formatOptionalReportAmount(value as number | null);
  }
  return formatReportAmount(value as number);
}

function SummaryBlock({ summary, emphasizeLast }: { summary: ReportSummary; emphasizeLast: boolean }) {
  return (
    <div className="mt-3">
      <div className="border-t border-black pt-2">
        <p className="font-bold text-sm">{'סה"כ'}</p>
      </div>
      <dl className="mt-1.5 text-sm">
        {SUMMARY_ROWS.map((row, i) => {
          const isLast = i === SUMMARY_ROWS.length - 1;
          const bold = isLast && emphasizeLast;
          return (
            <div
              key={row.key}
              className={`flex items-baseline justify-between gap-4 py-0.5 ${
                bold ? "border-t border-black mt-1 pt-1.5" : ""
              }`}
            >
              <dt className={bold ? "font-bold" : ""}>{row.label}</dt>
              <dd className={`tabular-nums ${bold ? "font-bold text-base" : ""}`} dir="ltr">
                {summaryValue(summary, row.key)}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function DetailTable({ rows }: { rows: ReportGroup["rows"] }) {
  return (
    <table className="report-detail-table text-xs w-full" dir="rtl">
      <colgroup>
        <col className="report-detail-col-code" />
        <col className="report-detail-col-name" />
        <col />
        <col />
        <col />
        <col />
        <col />
        <col />
        <col />
        <col />
      </colgroup>
      <thead>
        <tr className="border-b-2 border-black">
          <th className="text-start">קוד</th>
          <th className="text-start">שם אמצעי תשלום</th>
          <th className="text-center">
            מס&apos; תנועות
            <br />
            זכות
          </th>
          <th className="text-center">
            {'סה"כ'}
            <br />
            זכות
          </th>
          <th className="text-center">
            מס&apos; תנועות
            <br />
            חובה
          </th>
          <th className="text-center">
            {'סה"כ'}
            <br />
            חובה
          </th>
          <th className="text-center">TOTAL</th>
          <th className="text-center">
            סגירת
            <br />
            חשבון
          </th>
          <th className="text-center">
            קבלת
            <br />
            הקפה
          </th>
          <th className="text-center">
            {'סה"כ'}
            <br />
            תקבולים
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.code} className="border-b border-gray-400">
            <td className="font-mono whitespace-nowrap" dir="ltr">{row.code}</td>
            <td className="report-detail-cell-name">{row.name}</td>
            <td className="text-center tabular-nums" dir="ltr">{row.creditCount.toLocaleString("he-IL")}</td>
            <td className="text-center tabular-nums" dir="ltr">{formatReportAmount(row.creditAgorot)}</td>
            <td className="text-center tabular-nums" dir="ltr">{row.debitCount.toLocaleString("he-IL")}</td>
            <td className="text-center tabular-nums" dir="ltr">{formatReportAmount(row.debitAgorot)}</td>
            <td className="text-center tabular-nums font-semibold" dir="ltr">{formatReportAmount(row.totalAgorot)}</td>
            <td className="text-center">—</td>
            <td className="text-center">—</td>
            <td className="text-center tabular-nums font-semibold" dir="ltr">{formatReportAmount(row.totalAgorot)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GroupSection({ group }: { group: ReportGroup }) {
  return (
    <section className="report-pdf-section border-b border-gray-300 pb-4 mb-4">
      <h2 className="font-bold text-base mb-2">{group.heading}</h2>
      <DetailTable rows={group.rows} />
      <SummaryBlock summary={group.summary} emphasizeLast={false} />
    </section>
  );
}

export function SalesReportView({ data }: { data: GeneratedReport }) {
  const { report, business, filterFromDisplay, filterToDisplay, generatedAtDisplay } = data;

  return (
    <div className="sales-report bg-white text-black p-6 text-sm" dir="rtl">
      {/* ── Header + filters ──────────────────────────────────────────────── */}
      <section className="report-pdf-section pb-4 mb-4 border-b-2 border-black">
        <p className="font-bold text-lg">{business.name}</p>
        <p className="text-sm">{business.taxId ? `ח"פ ${business.taxId}` : 'ח"פ: לא זמין'}</p>
        <p className="text-xs text-gray-600 mt-1">הופק בתאריך {generatedAtDisplay}</p>

        <h1 className="text-base font-bold mt-4">
          {'דוח מכירות אתר - א.תשלום מרוכז (לפי קבוצות א.תשלום)'}
        </h1>

        <div className="mt-3 text-sm">
          <p className="font-bold">מסננים</p>
          <p dir="ltr" className="text-end">
            תאריך יצירה: {filterFromDisplay} - {filterToDisplay}
          </p>
        </div>
      </section>

      {/* ── Payment groups ──────────────────────────────────────────────────── */}
      {report.groups.map((group) => (
        <GroupSection key={group.key} group={group} />
      ))}

      {/* ── Grand total ──────────────────────────────────────────────────────── */}
      <section className="report-pdf-section pb-2">
        <h2 className="font-bold text-base mb-2">{'סה"כ לדוח'}</h2>
        <SummaryBlock summary={report.grandTotal} emphasizeLast />
      </section>
    </div>
  );
}
