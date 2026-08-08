/**
 * CardCom Low Profile webhook endpoint.
 *
 * This handler is intentionally thin. All verification and finalization logic
 * (GetLpResult call, all validation checks, CAS update, cart clear, emails)
 * lives in src/lib/payment/cardcomFinalize.ts so the webhook and admin manual
 * recovery share the exact same code path.
 *
 * Responsibilities here:
 * 1. Parse the raw webhook body (JSON or form-encoded).
 * 2. Log the incoming event.
 * 3. Validate the TerminalNumber from the webhook payload (first layer; the
 *    shared function also checks TerminalNumber from the GetLpResult response).
 * 4. Handle ResponseCode != 0 fast path: mark order failed without calling
 *    GetLpResult (which would also return failure).
 * 5. Delegate ResponseCode === 0 to verifyAndFinalizeCardcomPayment.
 * 6. Map FinalizeResult → HTTP response:
 *    - transient_error → 500 so Cardcom retries.
 *    - everything else  → 200 so Cardcom stops retrying.
 *
 * Never marks orders paid based on the webhook payload alone.
 * Cart is cleared and emails are sent only from the shared finalization module.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { verifyAndFinalizeCardcomPayment } from "@/lib/payment/cardcomFinalize";

export const runtime = "nodejs";

function makeAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Missing Supabase admin credentials");
  return createClient<Database>(url, key);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const contentType = req.headers.get("content-type") ?? "";
  const rawBody     = await req.text();

  let params: Record<string, string>;
  if (contentType.includes("application/json")) {
    try {
      params = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "invalid json" }, { status: 400 });
    }
  } else {
    params = Object.fromEntries(new URLSearchParams(rawBody));
  }

  const webhookResponseCode = parseInt(params["ResponseCode"] ?? "-1", 10);
  const lowProfileId        = params["LowProfileId"]    ?? "";
  const orderId             = params["ReturnValue"]      ?? "";
  const terminalNumber      = params["TerminalNumber"]   ?? "";

  console.log("[cardcom:webhook]", {
    event:               "webhook_received",
    orderId,
    lowProfileId,
    webhookResponseCode,
  });

  // ── Layer 1: terminal check on webhook payload ─────────────────────────────
  // The shared function also checks TerminalNumber from the GetLpResult response
  // (layer 2). Return 200 on mismatch — permanent condition, no retry needed.
  const expectedTerminal = process.env.CARDCOM_TERMINAL_NUMBER ?? "";
  if (expectedTerminal && terminalNumber && terminalNumber !== expectedTerminal) {
    console.error("[cardcom:webhook]", {
      event:    "terminal_mismatch",
      received: terminalNumber,
      expected: expectedTerminal,
    });
    return NextResponse.json({ received: true });
  }

  if (!orderId) {
    console.warn("[cardcom:webhook]", { event: "missing_order_id" });
    return NextResponse.json({ received: true });
  }

  // ── Reported failure ───────────────────────────────────────────────────────
  //
  // This endpoint is unauthenticated, so the payload alone proves nothing. It
  // used to mark the order failed directly, which let anyone who learned an
  // order id POST {"ReturnValue": id, "ResponseCode": 1} and flip a genuine
  // pending payment to failed — griefing a real customer mid-checkout.
  //
  // A reported failure is now only a HINT. The order is touched solely on the
  // authority of GetLpResult, exactly like a reported success; the shared
  // finalizer marks the order failed when CardCom itself reports a non-zero
  // ResponseCode. Without a LowProfileId there is nothing to verify against, so
  // nothing is written at all.
  if (webhookResponseCode !== 0) {
    console.log("[cardcom:webhook]", {
      event:               "payment_failure_reported",
      orderId,
      webhookResponseCode,
    });

    if (!lowProfileId) {
      console.warn("[cardcom:webhook]", { event: "failure_without_session", orderId });
      return NextResponse.json({ received: true });
    }

    const db     = makeAdminClient();
    const result = await verifyAndFinalizeCardcomPayment(orderId, lowProfileId, db);

    console.log("[cardcom:webhook]", {
      event:   "failure_verified_outcome",
      orderId,
      outcome: result.outcome,
      reason:  "reason" in result ? result.reason : undefined,
    });

    if (result.outcome === "transient_error") {
      return NextResponse.json({ error: "transient error" }, { status: 500 });
    }
    return NextResponse.json({ received: true });
  }

  // ── Missing LowProfileId guard ─────────────────────────────────────────────
  if (!lowProfileId) {
    console.error("[cardcom:webhook]", { event: "missing_low_profile_id", orderId });
    // Return 200: a retry won't produce a LowProfileId that wasn't sent.
    return NextResponse.json({ received: true });
  }

  // ── Delegate to shared verification/finalization ───────────────────────────
  const db     = makeAdminClient();
  const result = await verifyAndFinalizeCardcomPayment(orderId, lowProfileId, db);

  console.log("[cardcom:webhook]", {
    event:      "finalize_outcome",
    orderId,
    lowProfileId,
    outcome:    result.outcome,
    reason:     "reason" in result ? result.reason : undefined,
  });

  // Only transient errors should cause Cardcom to retry (the order is still
  // in pending state so a retry is safe and correct).
  if (result.outcome === "transient_error") {
    return NextResponse.json({ error: "transient error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
