import { ADMIN_BASE_PATH } from "@/lib/admin/routes";
import { getAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import {
  fetchCardcomDocumentPdf,
  fetchCardcomDocumentUrl,
  invoiceUnavailableMessage,
  resolveInvoiceReference,
} from "@/lib/cardcom-documents";

/**
 * Opens (or prints) the ORIGINAL Cardcom Tax Invoice/Receipt of a paid order.
 *
 *   GET …/orders/{id}/invoice          → the PDF, shown inline
 *   GET …/orders/{id}/invoice?print=1  → a page that embeds that PDF and prints it
 *
 * Read-only by construction: it looks up the document identifiers stored on the
 * order, asks Cardcom for the URL of that EXISTING document and streams the PDF
 * through. It never creates a document, charges anything or writes to the
 * database. The PDF is streamed (not redirected) so the tokenised Cardcom link
 * and the API credentials never reach the browser.
 *
 * Route handlers are outside the protected layout, so administrator access is
 * checked here; anyone else gets an indistinguishable 404.
 */

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NO_STORE = { "Cache-Control": "private, no-store" };

function text(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", ...NO_STORE },
  });
}

const PRINT_PAGE = (src: string) => `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>הדפסת חשבונית</title>
<style>
  html, body { margin: 0; height: 100%; font-family: system-ui, sans-serif; }
  .bar { padding: 8px 12px; background: #f3f4f6; border-bottom: 1px solid #e5e7eb; }
  .bar button { padding: 6px 14px; font-size: 14px; cursor: pointer; }
  iframe { width: 100%; height: calc(100% - 45px); border: 0; }
  @media print { .bar { display: none; } iframe { height: 100%; } }
</style>
</head>
<body>
<div class="bar"><button type="button" id="p">הדפסה</button></div>
<iframe id="f" src="${src}" title="חשבונית"></iframe>
<script>
  var f = document.getElementById("f");
  function doPrint() { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { window.print(); } }
  document.getElementById("p").addEventListener("click", doPrint);
  f.addEventListener("load", function () { setTimeout(doPrint, 300); }, { once: true });
</script>
</body>
</html>`;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const admin = await getAdminUser();
  if (!admin) return text(404, "Not found");

  const { id } = await params;
  if (!UUID.test(id)) return text(404, "Not found");

  const db = createAdminClient();
  const { data: order, error } = await db
    .from("orders")
    .select("id, order_number, payment_method, payment_status, payment_metadata")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[admin:invoice]", { event: "order_lookup_failed", orderId: id, code: error.code });
    return text(500, "שגיאה בטעינת ההזמנה");
  }
  if (!order) return text(404, "Not found");

  const reference = resolveInvoiceReference(order);
  if (reference.kind !== "available") {
    return text(404, invoiceUnavailableMessage(reference.reason) ?? "Not found");
  }

  if (new URL(request.url).searchParams.get("print") === "1") {
    return new Response(PRINT_PAGE(`${ADMIN_BASE_PATH}/orders/${order.id}/invoice`), {
      headers: { "Content-Type": "text/html; charset=utf-8", ...NO_STORE },
    });
  }

  const located = await fetchCardcomDocumentUrl(reference.documentType, reference.documentNumber);
  if (!located.ok) {
    if (located.error === "not_found") return text(404, "לא נמצאה חשבונית");
    return text(502, "לא ניתן לשלוף את החשבונית מ-Cardcom כרגע. נא לנסות שוב בעוד מספר רגעים.");
  }

  const pdf = await fetchCardcomDocumentPdf(located.url);
  if (!pdf.ok) {
    return text(502, "לא ניתן לשלוף את החשבונית מ-Cardcom כרגע. נא לנסות שוב בעוד מספר רגעים.");
  }

  return new Response(pdf.bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${order.order_number}.pdf"`,
      "X-Content-Type-Options": "nosniff",
      ...NO_STORE,
    },
  });
}
