/**
 * Reading back the Cardcom Tax Invoice/Receipt that belongs to an order.
 *
 * Nothing here ever creates, edits or cancels a document. Identifiers come from
 * the verified payment result already stored on the order (`payment_metadata`,
 * written by cardcomFinalize from LowProfile/GetLpResult), and the only Cardcom
 * calls are the lookup of an EXISTING document's download URL
 * (Documents/CreateDocumentUrl — despite its name it only returns a URL for a
 * document that already exists) and the download of that PDF.
 *
 * Server only: it reads CARDCOM_API_PASSWORD. Never import from client code.
 */

import type { Json } from "@/types/database";

/** Document types an administrator may open as "the invoice". An "Order" is NOT one. */
export const INVOICE_DOCUMENT_TYPES = ["TaxInvoiceAndReceipt", "TaxInvoice"] as const;
export type InvoiceDocumentType = (typeof INVOICE_DOCUMENT_TYPES)[number];

export type InvoiceUnavailableReason =
  /** Not a paid order — no invoice is offered and nothing is shown. */
  | "not_paid"
  /** Cash / phone / mock payment: Cardcom never produced a document. */
  | "not_card"
  /** Paid by card but Cardcom returned no document. */
  | "no_document"
  /** Cardcom produced only a non-invoice document (e.g. an Order confirmation). */
  | "order_document_only"
  /** Identifiers are missing, malformed or Cardcom reported a document error. */
  | "invalid_identifiers"
  /** The stored payment result does not belong to this order. */
  | "order_mismatch";

export type InvoiceReference =
  | {
      kind: "available";
      documentType: InvoiceDocumentType;
      documentNumber: number;
      /** Cardcom's credit-card transaction id, kept for traceability. */
      transactionId: string | null;
    }
  | { kind: "unavailable"; reason: InvoiceUnavailableReason };

export interface InvoiceOrderFacts {
  id: string;
  payment_method: string | null;
  payment_status: string;
  payment_metadata: Json | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Decide, from stored facts alone, whether an order has a viewable invoice.
 *
 * The association is only trusted when the stored Cardcom result proves it
 * belongs to this order: ReturnValue (the order id we sent as the session's
 * return value) must equal the order id and both the session and the
 * transaction must have succeeded. No document number is ever inferred.
 */
export function resolveInvoiceReference(order: InvoiceOrderFacts): InvoiceReference {
  if (order.payment_status !== "paid") return { kind: "unavailable", reason: "not_paid" };
  if (order.payment_method !== "credit_card") return { kind: "unavailable", reason: "not_card" };

  const meta = asRecord(order.payment_metadata);
  if (!meta) return { kind: "unavailable", reason: "no_document" };

  if (meta.ReturnValue !== order.id) return { kind: "unavailable", reason: "order_mismatch" };

  const tranzaction = asRecord(meta.TranzactionInfo);
  if (meta.ResponseCode !== 0 || !tranzaction || tranzaction.ResponseCode !== 0) {
    return { kind: "unavailable", reason: "order_mismatch" };
  }

  const info = asRecord(meta.DocumentInfo);
  if (!info) return { kind: "unavailable", reason: "no_document" };

  if (info.ResponseCode !== undefined && info.ResponseCode !== 0) {
    return { kind: "unavailable", reason: "invalid_identifiers" };
  }

  const type = info.DocumentType;
  if (typeof type !== "string" || type === "") {
    return { kind: "unavailable", reason: "invalid_identifiers" };
  }
  if (!(INVOICE_DOCUMENT_TYPES as readonly string[]).includes(type)) {
    return { kind: "unavailable", reason: type === "Order" ? "order_document_only" : "no_document" };
  }

  const number = info.DocumentNumber;
  if (typeof number !== "number" || !Number.isInteger(number) || number <= 0) {
    return { kind: "unavailable", reason: "invalid_identifiers" };
  }

  const rawTransactionId = tranzaction.TranzactionId ?? meta.TranzactionId;
  const transactionId =
    typeof rawTransactionId === "number" || typeof rawTransactionId === "string"
      ? String(rawTransactionId)
      : null;

  return {
    kind: "available",
    documentType: type as InvoiceDocumentType,
    documentNumber: number,
    transactionId,
  };
}

/** Hebrew status shown instead of the buttons. `null` = show nothing at all. */
export function invoiceUnavailableMessage(reason: InvoiceUnavailableReason): string | null {
  switch (reason) {
    case "not_paid":
    case "not_card":
      return null;
    case "order_document_only":
      return "לא נמצאה חשבונית — במערכת קיים רק מסמך הזמנה";
    case "invalid_identifiers":
    case "order_mismatch":
      return "לא נמצאה חשבונית — פרטי המסמך אינם תקינים";
    case "no_document":
    default:
      return "לא נמצאה חשבונית";
  }
}

// ─── Cardcom calls ────────────────────────────────────────────────────────────

const DOCUMENT_URL_ENDPOINT = "https://secure.cardcom.solutions/api/v11/Documents/CreateDocumentUrl";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_PDF_BYTES = 10 * 1024 * 1024;

export type DocumentUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: "not_configured" | "not_found" | "unavailable" };

/** Only Cardcom's own https hosts may ever be fetched on an administrator's behalf. */
export function isTrustedCardcomUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return (
      url.protocol === "https:" &&
      (url.hostname === "cardcom.solutions" ||
        url.hostname.endsWith(".cardcom.solutions") ||
        url.hostname === "cardcom.co.il" ||
        url.hostname.endsWith(".cardcom.co.il"))
    );
  } catch {
    return false;
  }
}

/**
 * Look up the download URL of an EXISTING document. Read-only: this endpoint
 * does not create a document or touch any payment.
 */
export async function fetchCardcomDocumentUrl(
  documentType: InvoiceDocumentType,
  documentNumber: number
): Promise<DocumentUrlResult> {
  const apiName = process.env.CARDCOM_API_NAME;
  const apiPassword = process.env.CARDCOM_API_PASSWORD;
  if (!apiName || !apiPassword) return { ok: false, error: "not_configured" };

  try {
    const response = await fetch(DOCUMENT_URL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ApiName: apiName,
        ApiPassword: apiPassword,
        DocumentType: documentType,
        DocumentNumber: documentNumber,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    // Cardcom answers an unknown document number with HTTP 404.
    if (response.status === 404) return { ok: false, error: "not_found" };
    if (!response.ok) {
      console.error("[cardcom:document]", { event: "url_http_error", status: response.status });
      return { ok: false, error: "unavailable" };
    }

    const data = (await response.json()) as { ResponseCode?: number; DocUrl?: string | null };
    if (data.ResponseCode !== 0 || !data.DocUrl || !isTrustedCardcomUrl(data.DocUrl)) {
      console.error("[cardcom:document]", { event: "url_rejected", responseCode: data.ResponseCode });
      return { ok: false, error: "unavailable" };
    }
    return { ok: true, url: data.DocUrl };
  } catch (e) {
    console.error("[cardcom:document]", {
      event: "url_request_failed",
      error: e instanceof Error ? e.message : String(e),
    });
    return { ok: false, error: "unavailable" };
  }
}

export type DocumentPdfResult =
  | { ok: true; bytes: ArrayBuffer }
  | { ok: false; error: "unavailable" };

/** Download the PDF at a URL returned by fetchCardcomDocumentUrl. */
export async function fetchCardcomDocumentPdf(url: string): Promise<DocumentPdfResult> {
  if (!isTrustedCardcomUrl(url)) return { ok: false, error: "unavailable" };
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !type.toLowerCase().startsWith("application/pdf")) {
      console.error("[cardcom:document]", { event: "pdf_rejected", status: response.status, type });
      return { ok: false, error: "unavailable" };
    }
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_PDF_BYTES) {
      return { ok: false, error: "unavailable" };
    }
    return { ok: true, bytes };
  } catch (e) {
    console.error("[cardcom:document]", {
      event: "pdf_request_failed",
      error: e instanceof Error ? e.message : String(e),
    });
    return { ok: false, error: "unavailable" };
  }
}
