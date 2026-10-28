import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchCardcomDocumentPdf,
  fetchCardcomDocumentUrl,
  invoiceUnavailableMessage,
  isTrustedCardcomUrl,
  resolveInvoiceReference,
  type InvoiceOrderFacts,
} from "@/lib/cardcom-documents";

/**
 * Invoice-to-order association and the Cardcom lookups. `fetch` is stubbed —
 * nothing here reaches Cardcom or creates a document.
 */

const ORDER_ID = "11111111-2222-4333-8444-555555555555";

function paidOrder(overrides: Partial<InvoiceOrderFacts> = {}, doc: Record<string, unknown> | null = {
  DocumentType: "TaxInvoiceAndReceipt", DocumentNumber: 33, ResponseCode: 0,
}): InvoiceOrderFacts {
  return {
    id: ORDER_ID,
    payment_method: "credit_card",
    payment_status: "paid",
    payment_metadata: {
      ResponseCode: 0,
      ReturnValue: ORDER_ID,
      TranzactionId: 123456789,
      TranzactionInfo: { ResponseCode: 0, TranzactionId: 123456789 },
      DocumentInfo: doc,
    } as never,
    ...overrides,
  };
}

describe("resolveInvoiceReference — association with the order", () => {
  it("links a paid card order to the tax invoice Cardcom created for that very payment", () => {
    expect(resolveInvoiceReference(paidOrder())).toEqual({
      kind: "available",
      documentType: "TaxInvoiceAndReceipt",
      documentNumber: 33,
      transactionId: "123456789",
    });
  });

  it("refuses a stored payment result that belongs to a different order", () => {
    const order = paidOrder();
    (order.payment_metadata as Record<string, unknown>).ReturnValue = "99999999-2222-4333-8444-555555555555";
    expect(resolveInvoiceReference(order)).toEqual({ kind: "unavailable", reason: "order_mismatch" });
  });

  it("refuses when the payment or transaction did not succeed", () => {
    const failed = paidOrder();
    (failed.payment_metadata as Record<string, unknown>).ResponseCode = 5118;
    expect(resolveInvoiceReference(failed)).toEqual({ kind: "unavailable", reason: "order_mismatch" });

    const noTran = paidOrder();
    delete (noTran.payment_metadata as Record<string, unknown>).TranzactionInfo;
    expect(resolveInvoiceReference(noTran)).toEqual({ kind: "unavailable", reason: "order_mismatch" });
  });
});

describe("resolveInvoiceReference — what is never offered", () => {
  it("offers nothing for orders that are not paid", () => {
    for (const payment_status of ["pending", "failed", "refunded"]) {
      expect(resolveInvoiceReference(paidOrder({ payment_status }))).toEqual({ kind: "unavailable", reason: "not_paid" });
    }
  });

  it("offers nothing for payment methods without a Cardcom document", () => {
    for (const payment_method of ["cash", "phone_credit", "card_mock", null]) {
      expect(resolveInvoiceReference(paidOrder({ payment_method }))).toEqual({ kind: "unavailable", reason: "not_card" });
    }
  });

  it("an 'Order' confirmation is not an invoice", () => {
    const result = resolveInvoiceReference(paidOrder({}, { DocumentType: "Order", DocumentNumber: 3, ResponseCode: 0 }));
    expect(result).toEqual({ kind: "unavailable", reason: "order_document_only" });
    expect(invoiceUnavailableMessage("order_document_only")).toContain("לא נמצאה חשבונית");
  });

  it("historical paid orders with no stored payment result have no invoice (nothing is guessed)", () => {
    expect(resolveInvoiceReference(paidOrder({ payment_metadata: null }))).toEqual({ kind: "unavailable", reason: "no_document" });
    expect(resolveInvoiceReference(paidOrder({}, null))).toEqual({ kind: "unavailable", reason: "no_document" });
  });

  it.each([
    ["missing number", { DocumentType: "TaxInvoiceAndReceipt", ResponseCode: 0 }],
    ["zero", { DocumentType: "TaxInvoiceAndReceipt", DocumentNumber: 0, ResponseCode: 0 }],
    ["negative", { DocumentType: "TaxInvoiceAndReceipt", DocumentNumber: -4, ResponseCode: 0 }],
    ["fractional", { DocumentType: "TaxInvoiceAndReceipt", DocumentNumber: 3.5, ResponseCode: 0 }],
    ["string", { DocumentType: "TaxInvoiceAndReceipt", DocumentNumber: "33", ResponseCode: 0 }],
    ["missing type", { DocumentNumber: 33, ResponseCode: 0 }],
    ["Cardcom document error", { DocumentType: "TaxInvoiceAndReceipt", DocumentNumber: 33, ResponseCode: 701 }],
  ])("rejects invalid identifiers: %s", (_label, doc) => {
    expect(resolveInvoiceReference(paidOrder({}, doc as Record<string, unknown>))).toMatchObject({ kind: "unavailable" });
  });

  it("shows no message at all for unpaid / non-card orders, and Hebrew text otherwise", () => {
    expect(invoiceUnavailableMessage("not_paid")).toBeNull();
    expect(invoiceUnavailableMessage("not_card")).toBeNull();
    expect(invoiceUnavailableMessage("no_document")).toBe("לא נמצאה חשבונית");
  });
});

// ─── Cardcom lookups ──────────────────────────────────────────────────────────

const ENV = { ...process.env };
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.CARDCOM_API_NAME = "api-user";
  process.env.CARDCOM_API_PASSWORD = "api-secret";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  process.env = { ...ENV };
});

const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) });
const DOC_URL = "https://secure.cardcom.solutions/api/v11/documents/DownloadDoc/?token=abc";

describe("fetchCardcomDocumentUrl", () => {
  it("looks up an existing document with exactly one read-only request", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { ResponseCode: 0, DocUrl: DOC_URL }));
    const result = await fetchCardcomDocumentUrl("TaxInvoiceAndReceipt", 33);

    expect(result).toEqual({ ok: true, url: DOC_URL });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, init] = fetchMock.mock.calls[0];
    expect(endpoint).toBe("https://secure.cardcom.solutions/api/v11/Documents/CreateDocumentUrl");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      ApiName: "api-user", ApiPassword: "api-secret", DocumentType: "TaxInvoiceAndReceipt", DocumentNumber: 33,
    });
    // Never the endpoints that create documents or charge cards.
    expect(String(endpoint)).not.toMatch(/CreateDocument$|LowProfile|ExternalShop|Charge/);
  });

  it("reports an unknown document (HTTP 404) as not_found", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: async () => { throw new Error("not json"); } });
    expect(await fetchCardcomDocumentUrl("TaxInvoiceAndReceipt", 999999)).toEqual({ ok: false, error: "not_found" });
  });

  it("fails gracefully, without calling Cardcom, when credentials are not configured", async () => {
    delete process.env.CARDCOM_API_PASSWORD;
    expect(await fetchCardcomDocumentUrl("TaxInvoiceAndReceipt", 33)).toEqual({ ok: false, error: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["server error", () => json(500, {})],
    ["API error code", () => json(200, { ResponseCode: 703, DocUrl: null })],
    ["missing url", () => json(200, { ResponseCode: 0 })],
    ["url on a foreign host", () => json(200, { ResponseCode: 0, DocUrl: "https://evil.example/x.pdf" })],
  ])("treats %s as unavailable", async (_label, make) => {
    fetchMock.mockResolvedValueOnce(make());
    expect(await fetchCardcomDocumentUrl("TaxInvoiceAndReceipt", 33)).toEqual({ ok: false, error: "unavailable" });
  });

  it("treats a network failure or timeout as unavailable instead of throwing", async () => {
    fetchMock.mockRejectedValueOnce(new Error("socket hang up"));
    expect(await fetchCardcomDocumentUrl("TaxInvoiceAndReceipt", 33)).toEqual({ ok: false, error: "unavailable" });
  });
});

describe("fetchCardcomDocumentPdf / isTrustedCardcomUrl", () => {
  it("only trusts https URLs on Cardcom's own hosts", () => {
    expect(isTrustedCardcomUrl(DOC_URL)).toBe(true);
    for (const bad of ["http://secure.cardcom.solutions/x", "https://cardcom.solutions.evil.com/x", "https://evil.example/x", "not a url"]) {
      expect(isTrustedCardcomUrl(bad)).toBe(false);
    }
  });

  it("returns the PDF bytes", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.7 …").buffer;
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers({ "content-type": "application/pdf" }), arrayBuffer: async () => bytes });
    expect(await fetchCardcomDocumentPdf(DOC_URL)).toEqual({ ok: true, bytes });
  });

  it("rejects non-PDF responses, empty bodies, and untrusted URLs (without fetching)", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers({ "content-type": "text/html" }), arrayBuffer: async () => new ArrayBuffer(10) });
    expect(await fetchCardcomDocumentPdf(DOC_URL)).toEqual({ ok: false, error: "unavailable" });

    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers({ "content-type": "application/pdf" }), arrayBuffer: async () => new ArrayBuffer(0) });
    expect(await fetchCardcomDocumentPdf(DOC_URL)).toEqual({ ok: false, error: "unavailable" });

    fetchMock.mockClear();
    expect(await fetchCardcomDocumentPdf("https://evil.example/x.pdf")).toEqual({ ok: false, error: "unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
