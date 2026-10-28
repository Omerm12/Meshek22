import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The admin invoice route: admin-only, read-only, never creates a document.
 * Supabase, auth and `fetch` are stubbed.
 */

const { adminRef, dbRef } = vi.hoisted(() => ({
  adminRef: { current: null as unknown },
  dbRef: { current: null as unknown },
}));

vi.mock("@/lib/admin/auth", () => ({ getAdminUser: async () => adminRef.current }));
vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => dbRef.current }));

import { GET } from "./route";

const ORDER_ID = "11111111-2222-4333-8444-555555555555";
const DOC_URL = "https://secure.cardcom.solutions/api/v11/documents/DownloadDoc/?token=abc";

function orderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    order_number: "M22-001359",
    payment_method: "credit_card",
    payment_status: "paid",
    payment_metadata: {
      ResponseCode: 0,
      ReturnValue: ORDER_ID,
      TranzactionInfo: { ResponseCode: 0, TranzactionId: 5 },
      DocumentInfo: { ResponseCode: 0, DocumentType: "TaxInvoiceAndReceipt", DocumentNumber: 33 },
    },
    ...overrides,
  };
}

/** Read-only stub: any write attempt throws, proving the route never writes. */
function makeDb(row: Record<string, unknown> | null, error: unknown = null) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({ data: row, error }),
    insert: () => { throw new Error("write attempted"); },
    update: () => { throw new Error("write attempted"); },
    upsert: () => { throw new Error("write attempted"); },
    delete: () => { throw new Error("write attempted"); },
  };
  return { from: () => builder };
}

let fetchMock: ReturnType<typeof vi.fn>;

const call = (id = ORDER_ID, query = "") =>
  GET(new Request(`https://shop.example/meshek22-control/orders/${id}/invoice${query}`), {
    params: Promise.resolve({ id }),
  });

beforeEach(() => {
  process.env.CARDCOM_API_NAME = "api-user";
  process.env.CARDCOM_API_PASSWORD = "api-secret";
  adminRef.current = { id: "admin-1", role: "admin" };
  dbRef.current = makeDb(orderRow());
  fetchMock = vi.fn(async (url: string) => {
    if (String(url).endsWith("/Documents/CreateDocumentUrl")) {
      return { ok: true, status: 200, json: async () => ({ ResponseCode: 0, DocUrl: DOC_URL }) };
    }
    return {
      ok: true, status: 200,
      headers: new Headers({ "content-type": "application/pdf" }),
      arrayBuffer: async () => new TextEncoder().encode("%PDF-1.7 invoice").buffer,
    };
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("access control", () => {
  it("returns an indistinguishable 404 to a non-admin and touches neither the database nor Cardcom", async () => {
    adminRef.current = null;
    const readSpy = vi.fn();
    dbRef.current = { from: readSpy };

    const res = await call();
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("Not found");
    expect(readSpy).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed order id before any lookup", async () => {
    const res = await call("not-a-uuid");
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("serving the invoice", () => {
  it("streams the original PDF inline, using only the document-URL lookup and the download", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toContain("inline");
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(await res.text()).toContain("%PDF");

    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls).toEqual([
      "https://secure.cardcom.solutions/api/v11/Documents/CreateDocumentUrl",
      DOC_URL,
    ]);
    // Requests the stored identifiers, not anything guessed.
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toMatchObject({ DocumentType: "TaxInvoiceAndReceipt", DocumentNumber: 33 });
  });

  it("never leaks credentials or the tokenised Cardcom URL to the browser", async () => {
    const res = await call();
    const dump = JSON.stringify([...res.headers.entries()]) + (await res.text());
    expect(dump).not.toContain("api-secret");
    expect(dump).not.toContain("token=abc");
  });

  it("print mode returns a page embedding the same-origin PDF and makes no Cardcom call", async () => {
    const res = await call(ORDER_ID, "?print=1");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain(`/meshek22-control/orders/${ORDER_ID}/invoice"`);
    expect(html).toContain("print()");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("orders without an invoice", () => {
  it.each([
    ["unpaid", { payment_status: "pending" }],
    ["cash", { payment_method: "cash" }],
    ["no stored document", { payment_metadata: null }],
    ["order-confirmation only", {
      payment_metadata: {
        ResponseCode: 0, ReturnValue: ORDER_ID, TranzactionInfo: { ResponseCode: 0 },
        DocumentInfo: { ResponseCode: 0, DocumentType: "Order", DocumentNumber: 3 },
      },
    }],
    ["invalid document number", {
      payment_metadata: {
        ResponseCode: 0, ReturnValue: ORDER_ID, TranzactionInfo: { ResponseCode: 0 },
        DocumentInfo: { ResponseCode: 0, DocumentType: "TaxInvoiceAndReceipt", DocumentNumber: "abc" },
      },
    }],
  ])("%s → 404 and no Cardcom call (no document is ever created)", async (_label, override) => {
    dbRef.current = makeDb(orderRow(override));
    const res = await call();
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("unknown order → 404", async () => {
    dbRef.current = makeDb(null);
    expect((await call()).status).toBe(404);
  });
});

describe("failures", () => {
  it("a Cardcom lookup failure is a readable 502, not a crash", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    const res = await call();
    expect(res.status).toBe(502);
    expect(await res.text()).toContain("Cardcom");
  });

  it("a document Cardcom no longer has is a 404 'not found'", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });
    const res = await call();
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("לא נמצאה חשבונית");
  });

  it("Cardcom returning something other than a PDF is a 502", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ResponseCode: 0, DocUrl: DOC_URL }) })
      .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers({ "content-type": "text/html" }), arrayBuffer: async () => new ArrayBuffer(5) });
    expect((await call()).status).toBe(502);
  });

  it("a database error is a 500 and calls nothing external", async () => {
    dbRef.current = makeDb(null, { code: "XX000", message: "boom" });
    expect((await call()).status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
