/**
 * PayPlus payment webhook endpoint.
 *
 * PayPlus sends a POST request to this URL when a payment is completed,
 * failed, or cancelled. This is the ONLY place where orders are marked as paid.
 *
 * Never mark an order as paid based solely on a success redirect URL —
 * redirects can be forged. Only trust this server-to-server webhook.
 *
 * PayPlus webhook documentation: https://developers.payplus.co.il
 *
 * REQUIRED configuration:
 *   PAYPLUS_SECRET_KEY   — used to verify the webhook signature (if enabled)
 *   SUPABASE_SERVICE_ROLE_KEY — used to update order status without RLS
 *
 * In PayPlus dashboard:
 *   Set the webhook URL to: https://yourdomain.co.il/api/payment/webhook
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Use service role (bypasses RLS) for secure server-side order updates.
// This route MUST run in Node.js runtime (not edge) for crypto support.
export const runtime = "nodejs";

type OrderUpdate = Database["public"]["Tables"]["orders"]["Update"];

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. " +
        "Add it to .env.local to enable webhook order updates."
    );
  }
  return createClient<Database>(url, key);
}

/**
 * PayPlus webhook payload (subset of relevant fields).
 * Full schema: https://developers.payplus.co.il/docs/webhooks
 */
interface PayPlusWebhookPayload {
  // Payment result: 0 = approved, 1 = declined, 2 = pending
  status?: number;
  // Transaction UID from PayPlus (use as payment_reference)
  transaction_uid?: string;
  // The refUID we set when creating the payment page (= order UUID)
  refUID?: string;
  // The more_info we set (= order_number)
  more_info?: string;
  // Payment method description
  payment_method_description?: string;
  // Total charged
  amount?: number;
  // ISO currency
  currency_code?: string;
  // Approval number from the card network
  approval_number?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Read raw body ──────────────────────────────────────────────────────────
  const rawBody = await req.text();

  // ── Optional: verify PayPlus signature ────────────────────────────────────
  // PayPlus sends a signature in x-payplus-signature header (when enabled in dashboard).
  // If PAYPLUS_SECRET_KEY is set, we validate; otherwise we skip (less secure).
  const signatureHeader = req.headers.get("x-payplus-signature");
  if (process.env.PAYPLUS_SECRET_KEY && signatureHeader) {
    const crypto = await import("crypto");
    const expected = crypto
      .createHmac("sha256", process.env.PAYPLUS_SECRET_KEY)
      .update(rawBody)
      .digest("hex");

    let valid = false;
    try {
      valid = crypto.timingSafeEqual(
        Buffer.from(signatureHeader, "hex"),
        Buffer.from(expected, "hex")
      );
    } catch {
      valid = false;
    }

    if (!valid) {
      console.warn("[webhook] Invalid PayPlus signature — rejecting request");
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
  }

  // ── Parse payload ──────────────────────────────────────────────────────────
  let payload: PayPlusWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.warn("[webhook] Could not parse webhook body");
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const {
    status: payStatus,
    transaction_uid: transactionUid,
    refUID: orderId,
    more_info: orderNumber,
    payment_method_description: paymentMethod,
  } = payload;

  // We need at least one identifier to find the order
  if (!orderId && !orderNumber) {
    console.warn("[webhook] Payload missing refUID and more_info");
    return NextResponse.json({ error: "missing order reference" }, { status: 400 });
  }

  // ── Prepare order update ───────────────────────────────────────────────────
  const now = new Date().toISOString();

  let orderUpdate: OrderUpdate;

  if (payStatus === 0) {
    // Payment approved
    orderUpdate = {
      payment_status: "paid",
      order_status: "confirmed",
      payment_reference: transactionUid ?? null,
      payment_method: paymentMethod ?? "credit_card",
      updated_at: now,
    };
  } else if (payStatus === 1) {
    // Payment declined
    orderUpdate = {
      payment_status: "failed",
      updated_at: now,
    };
  } else {
    // Unknown / pending — log and acknowledge without updating
    console.log(`[webhook] Unhandled payment status: ${payStatus} for order ${orderId ?? orderNumber}`);
    return NextResponse.json({ received: true });
  }

  // ── Update order in database ───────────────────────────────────────────────
  try {
    const supabase = getAdminSupabase();

    let query = supabase.from("orders").update(orderUpdate);

    if (orderId) {
      query = query.eq("id", orderId);
    } else {
      query = query.eq("order_number", orderNumber!);
    }

    const { error } = await query;

    if (error) {
      console.error("[webhook] Supabase update error:", error);
      // Return 500 so PayPlus retries
      return NextResponse.json({ error: "db update failed" }, { status: 500 });
    }

    console.log(
      `[webhook] Order ${orderId ?? orderNumber} updated: payment_status=${orderUpdate.payment_status}`
    );
  } catch (e) {
    console.error("[webhook] Unexpected error:", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }

  // PayPlus expects HTTP 200 to confirm receipt
  return NextResponse.json({ received: true });
}
