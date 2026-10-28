"use client";

import { useRef, useState, useTransition } from "react";
import { Download, FileBarChart, Loader2, Printer } from "lucide-react";
import { generateSalesReport, type GeneratedReport } from "@/app/meshek22-control/(protected)/reports/actions";
import { todayInIsrael } from "@/lib/utils/israel-time";
import { SalesReportView } from "@/components/admin/reports/SalesReportView";
import { buildReportFilename, downloadReportPdf } from "@/components/admin/reports/report-pdf";

const inputClass =
  "w-full h-11 px-3.5 rounded-xl border border-gray-300 bg-white text-gray-900 text-base sm:text-sm " +
  "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow";

export function SalesReportForm() {
  const today = todayInIsrael();
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedReport | null>(null);
  const [isGenerating, startGenerating] = useTransition();
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const handleGenerate = () => {
    setError(null);
    startGenerating(async () => {
      const outcome = await generateSalesReport(fromDate, toDate);
      if (!outcome.success) {
        setError(outcome.error);
        setResult(null);
        return;
      }
      setResult(outcome.data);
    });
  };

  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;
    setIsExportingPdf(true);
    try {
      await downloadReportPdf(reportRef.current, buildReportFilename(fromDate, toDate));
    } catch (thrown) {
      console.error("[admin:reports] PDF export failed", thrown);
      setError("יצירת קובץ ה-PDF נכשלה. ניתן להשתמש בכפתור ההדפסה כחלופה.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="print:hidden bg-white rounded-2xl border border-gray-200 p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="report-from" className="block text-sm font-medium text-gray-700 mb-1.5">
              מתאריך
            </label>
            <input
              id="report-from"
              type="date"
              value={fromDate}
              max={toDate}
              onChange={(e) => setFromDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="report-to" className="block text-sm font-medium text-gray-700 mb-1.5">
              עד תאריך
            </label>
            <input
              id="report-to"
              type="date"
              value={toDate}
              min={fromDate}
              onChange={(e) => setToDate(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating}
          className="mt-4 inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <FileBarChart className="h-4 w-4" aria-hidden="true" />
          )}
          {isGenerating ? "מפיק דוח..." : "הפקת דוח"}
        </button>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
            {error}
          </p>
        )}
      </div>

      {result && (
        <>
          <div className="print:hidden flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              הדפסה
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isExportingPdf ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-4 w-4" aria-hidden="true" />
              )}
              {isExportingPdf ? "מכין PDF..." : "הורדת PDF"}
            </button>
          </div>

          <div ref={reportRef} className="bg-white rounded-2xl border border-gray-200 overflow-hidden print:border-0 print:rounded-none">
            <SalesReportView data={result} />
          </div>
        </>
      )}
    </div>
  );
}
