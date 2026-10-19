/**
 * Client-only PDF export for the sales report.
 *
 * html2canvas-pro + jsPDF are dynamically imported so their bundle cost
 * (~450KB) is only ever paid by an admin who actually clicks "הורדת PDF" on
 * this one page, never by any other admin route.
 *
 * html2canvas-pro, not plain html2canvas: the admin UI's Tailwind v4
 * palette renders most grays/brand colors as CSS `oklch()` (see
 * tailwindcss's generated `--color-gray-*` custom properties), which
 * upstream html2canvas (last released before Tailwind v4) cannot parse at
 * all — it throws "Attempting to parse an unsupported color function
 * oklch" while cloning the document, before it even gets to the target
 * element. html2canvas-pro is an actively maintained, API-compatible fork
 * that adds support for oklch/lab/lch and is the standard fix for this
 * exact incompatibility.
 *
 * Captures each `.report-pdf-section` (see SalesReportView) as its own
 * image and packs them onto A4 pages, starting a new page whenever the next
 * section would not fit in the remaining space — never splitting a single
 * section (one payment group's heading + detail table + eight-row summary)
 * across two pages. This is a deliberately different mechanism from the
 * browser-print path's CSS `break-inside: avoid` (see globals.css): the
 * same "no section may be cut in half" requirement, enforced independently
 * for the html2canvas/jsPDF path, which does not interpret CSS page-break
 * rules at all.
 */

const PAGE_MARGIN_MM = 10;
/** Small visual gap between two sections packed onto the same page. */
const SECTION_GAP_MM = 4;

export async function downloadReportPdf(container: HTMLElement, filename: string): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  const sections = Array.from(container.querySelectorAll<HTMLElement>(".report-pdf-section"));
  if (sections.length === 0) return;

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - PAGE_MARGIN_MM * 2;
  const pageBottom = pageHeight - PAGE_MARGIN_MM;

  let cursorY = PAGE_MARGIN_MM;
  let isFirstSectionOnPage = true;

  for (const section of sections) {
    // Scale 2 for crisp Hebrew glyphs at print resolution; a plain 1:1
    // capture reads noticeably fuzzy once placed into a PDF page.
    const canvas = await html2canvas(section, { scale: 2, backgroundColor: "#ffffff" });
    // JPEG, not PNG: a lossless scale-2 PNG of a whole report produced a
    // 30+ MB file (every section is an uncompressed raster image) — far too
    // large to "open normally in standard PDF viewers" as the spec
    // requires. This is a flat black-text-on-white table, not a photo, so a
    // high-quality JPEG is visually indistinguishable here while landing at
    // a fraction of the size.
    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const imgHeight = (canvas.height * contentWidth) / canvas.width;

    if (!isFirstSectionOnPage && cursorY + imgHeight > pageBottom) {
      pdf.addPage();
      cursorY = PAGE_MARGIN_MM;
      isFirstSectionOnPage = true;
    }

    // A section taller than one whole page is placed anyway rather than
    // dropped — it should not happen in practice (every group is a handful
    // of table rows plus an eight-line summary), and an honest overflow is
    // preferable to silently discarding a payment group's data.
    pdf.addImage(imgData, "JPEG", PAGE_MARGIN_MM, cursorY, contentWidth, imgHeight);
    cursorY += imgHeight + SECTION_GAP_MM;
    isFirstSectionOnPage = false;
  }

  pdf.save(filename);
}

/** Meshek22_Website_Sales_Report_YYYY-MM-DD_to_YYYY-MM-DD.pdf — the spec's exact recommended filename. */
export function buildReportFilename(fromDate: string, toDate: string): string {
  return `Meshek22_Website_Sales_Report_${fromDate}_to_${toDate}.pdf`;
}
