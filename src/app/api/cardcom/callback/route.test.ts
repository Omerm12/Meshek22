import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Behavioural coverage for the webhook handler itself, focused on the exact
 * bug that let every real CardCom webhook slip past unverified:
 *
 * CardCom's webhook body is `Content-Type: application/json`, so a field like
 * TerminalNumber arrives as a JSON *number*. The handler's own "layer 1"
 * terminal check used to compare that raw value against
 * process.env.CARDCOM_TERMINAL_NUMBER (a string) with `!==`, which is `true`
 * for ANY numeric value — 172204100 !== "172204100" — so every real webhook
 * was treated as a terminal mismatch and returned 200 without ever calling
 * GetLpResult. CardCom saw success and stopped retrying; the order stayed
 * pending forever. The fix normalizes every parsed JSON value to a string
 * before anything is compared.
 *
 * verifyAndFinalizeCardcomPayment itself is mocked — its own behaviour is
 * covered in cardcomFinalize.test.ts. This file only asserts on whether the
 * route calls it, with what, and how the outcome maps to an HTTP response.
 */

const { verifyAndFinalizeCardcomPayment } = vi.hoisted(() => ({
  verifyAndFinalizeCardcomPayment: vi.fn(),
}));

vi.mock("@/lib/payment/cardcomFinalize", () => ({ verifyAndFinalizeCardcomPayment }));

import { POST } from "@/app/api/cardcom/callback/route";

const ORDER_ID = "785c9e89-ab1f-489d-842e-25de20abe12d";
const LOW_PROFILE_ID = "f3dbb871-b082-4aa9-bb86-3a6caa6c9bbe";
const TERMINAL_NUMBER = 172204100;

function jsonRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("https://meshek22.co.il/api/cardcom/callback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function formRequest(body: Record<string, string>): NextRequest {
  return new NextRequest("https://meshek22.co.il/api/cardcom/callback", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  process.env.CARDCOM_TERMINAL_NUMBER = String(TERMINAL_NUMBER);
  verifyAndFinalizeCardcomPayment.mockReset();
  verifyAndFinalizeCardcomPayment.mockResolvedValue({ outcome: "paid" });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.CARDCOM_TERMINAL_NUMBER;
});

describe("a real CardCom JSON webhook (TerminalNumber as a JSON number)", () => {
  it("is verified instead of being rejected as a terminal mismatch", async () => {
    const res = await POST(
      jsonRequest({
        ResponseCode: 0,
        LowProfileId: LOW_PROFILE_ID,
        ReturnValue: ORDER_ID,
        TerminalNumber: TERMINAL_NUMBER, // number, not "172204100"
      })
    );

    expect(verifyAndFinalizeCardcomPayment).toHaveBeenCalledTimes(1);
    expect(verifyAndFinalizeCardcomPayment).toHaveBeenCalledWith(
      ORDER_ID,
      LOW_PROFILE_ID,
      expect.anything()
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
  });

  it("still rejects a genuine terminal mismatch without calling GetLpResult", async () => {
    const res = await POST(
      jsonRequest({
        ResponseCode: 0,
        LowProfileId: LOW_PROFILE_ID,
        ReturnValue: ORDER_ID,
        TerminalNumber: 1, // a different terminal
      })
    );

    expect(verifyAndFinalizeCardcomPayment).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });
});

describe("form-encoded webhooks (already strings) keep working", () => {
  it("verifies a matching terminal", async () => {
    const res = await POST(
      formRequest({
        ResponseCode: "0",
        LowProfileId: LOW_PROFILE_ID,
        ReturnValue: ORDER_ID,
        TerminalNumber: String(TERMINAL_NUMBER),
      })
    );

    expect(verifyAndFinalizeCardcomPayment).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
  });
});

describe("outcome → HTTP status mapping", () => {
  it("returns 500 on a transient error so CardCom retries", async () => {
    verifyAndFinalizeCardcomPayment.mockResolvedValue({
      outcome: "transient_error",
      reason: "cas_update_failed",
    });

    const res = await POST(
      jsonRequest({
        ResponseCode: 0,
        LowProfileId: LOW_PROFILE_ID,
        ReturnValue: ORDER_ID,
        TerminalNumber: TERMINAL_NUMBER,
      })
    );

    expect(res.status).toBe(500);
  });

  it("returns 200 for a blocked (mismatched) result — no retry needed", async () => {
    verifyAndFinalizeCardcomPayment.mockResolvedValue({
      outcome: "blocked",
      reason: "amount_mismatch",
    });

    const res = await POST(
      jsonRequest({
        ResponseCode: 0,
        LowProfileId: LOW_PROFILE_ID,
        ReturnValue: ORDER_ID,
        TerminalNumber: TERMINAL_NUMBER,
      })
    );

    expect(res.status).toBe(200);
  });
});

describe("malformed or incomplete payloads", () => {
  it("rejects invalid JSON with 400", async () => {
    const req = new NextRequest("https://meshek22.co.il/api/cardcom/callback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(verifyAndFinalizeCardcomPayment).not.toHaveBeenCalled();
  });

  it("does nothing for a reported success with no LowProfileId", async () => {
    const res = await POST(
      jsonRequest({ ResponseCode: 0, ReturnValue: ORDER_ID, TerminalNumber: TERMINAL_NUMBER })
    );

    expect(verifyAndFinalizeCardcomPayment).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("does nothing for any webhook with no ReturnValue", async () => {
    const res = await POST(
      jsonRequest({ ResponseCode: 0, LowProfileId: LOW_PROFILE_ID, TerminalNumber: TERMINAL_NUMBER })
    );

    expect(verifyAndFinalizeCardcomPayment).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });
});

describe("a reported failure (ResponseCode != 0)", () => {
  it("is still routed through authoritative verification when a session id is present", async () => {
    verifyAndFinalizeCardcomPayment.mockResolvedValue({ outcome: "failed", reason: "ResponseCode=1: declined" });

    const res = await POST(
      jsonRequest({
        ResponseCode: 1,
        LowProfileId: LOW_PROFILE_ID,
        ReturnValue: ORDER_ID,
        TerminalNumber: TERMINAL_NUMBER,
      })
    );

    expect(verifyAndFinalizeCardcomPayment).toHaveBeenCalledWith(
      ORDER_ID,
      LOW_PROFILE_ID,
      expect.anything()
    );
    expect(res.status).toBe(200);
  });

  it("writes nothing when there is no session to verify against (can't be forged into failing a real order)", async () => {
    const res = await POST(
      jsonRequest({ ResponseCode: 1, ReturnValue: ORDER_ID, TerminalNumber: TERMINAL_NUMBER })
    );

    expect(verifyAndFinalizeCardcomPayment).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });
});
