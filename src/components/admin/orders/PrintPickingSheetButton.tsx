"use client";

import { Printer } from "lucide-react";

/**
 * Opens the browser print dialog. The picking sheet itself (PickingSheet) is
 * the only thing @media print leaves visible — see globals for the print
 * rules on AdminShell, and the `hidden print:block` / `print:hidden` split in
 * the order detail page.
 */
export function PrintPickingSheetButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
    >
      <Printer className="h-4 w-4" aria-hidden="true" />
      הדפס דף ליקוט
    </button>
  );
}
