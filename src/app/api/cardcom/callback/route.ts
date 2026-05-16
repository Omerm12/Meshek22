/**
 * CardCom Low Profile webhook endpoint.
 *
 * Flow:
 * 1. CardCom POSTs here when a payment attempt completes.
 * 2. We call LowProfile/GetLpResult to independently verify the result.
 * 3. Only if GetLpResult.ResponseCode === 0 and amounts match do we mark the order paid.
 * 4. We clear the user's DB cart and send confirmation emails exactly once.
 *
 * Idempotency: if the order is already paid we return HTTP 200 immediately so
 * CardCom stops retrying — without re-processing anything.
 *
 * CardCom retries the webhook if we return a non-200 status.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getLpResult } from "@/lib/cardcom";
import {
  sendCustomerOrderConfirmation,
  sendAdminNewOrderNotification,
} from "@/lib/email/service";
import type { OrderEmailData } from "@/lib/email/types";

export const runtime = "nodejs";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Missing Supabase admin credentials");
  return createClient<Database>(url, key);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const contentType = req.headers.get("content-type") ?? "";
  const rawBody = await req.text();

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
  const lowProfileId        = params["LowProfileId"] ?? "";
  const orderId             = params["ReturnValue"]   ?? ""; // order UUID set at session creation
  const terminalNumber      = params["TerminalNumber"] ?? "";

  // ── Terminal validation ────────────────────────────────────────────────────
  const expectedTerminal = process.env.CARDCOM_TERMINAL_NUMBER ?? "";
  if (expectedTerminal && terminalNumber && terminalNumber !== expectedTerminal) {
    console.warn("[cardcom-webhook] Terminal mismatch", {
      received: terminalNumber,
      expected: expectedTerminal,
    });
    return NextResponse.json({ error: "terminal mismatch" }, { status: 400 });
  }

  if (!orderId) {
    console.warn("[cardcom-webhook] Missing ReturnValue (orderId)");
    return NextResponse.json({ error: "missing order id" }, { status: 400 });
  }

  const supabase = getAdminSupabase();
  const now = new Date().toISOString();

  // ── Fetch order ────────────────────────────────────────────────────────────
  const { data: order, error: orderFetchError } = await supabase
    .from("orders")
    .select("id, user_id, total_agorot, payment_status, payment_reference")
    .eq("id", orderId)
    .single();

  if (orderFetchError || !order) {
    console.error("[cardcom-webhook] Order not found", {
      orderId,
      error: orderFetchError?.message ?? "no row",
    });
    // Return 200 so CardCom doesn't retry an order that may not exist in our system.
    return NextResponse.json({ error: "order not found" }, { status: 200 });
  }

  // ── Idempotency: already confirmed ────────────────────────────────────────
  if (order.payment_status === "paid") {
    console.log("[cardcom-webhook] Order already paid, ignoring duplicate webhook", { orderId });
    return NextResponse.json({ received: true });
  }

  // ── Failed payment ─────────────────────────────────────────────────────────
  if (webhookResponseCode !== 0) {
    await supabase
      .from("orders")
      .update({ payment_status: "failed", updated_at: now })
      .eq("id", orderId)
      .eq("payment_status", "pending"); // safe: no-op if already moved

    console.log(`[cardcom-webhook] Payment failed for order ${orderId}, code=${webhookResponseCode}`);
    return NextResponse.json({ received: true });
  }

  // ── Successful webhook: verify with GetLpResult ────────────────────────────
  if (!lowProfileId) {
    console.error("[cardcom-webhook] Missing LowProfileId for successful webhook", { orderId });
    return NextResponse.json({ error: "missing LowProfileId" }, { status: 400 });
  }

  let lpResult: Awaited<ReturnType<typeof getLpResult>>;
  try {
    lpResult = await getLpResult(lowProfileId);
  } catch (e) {
    console.error("[cardcom-webhook] GetLpResult call failed", { orderId, error: e });
    // Return 500 so CardCom retries — the order is still in pending_payment state.
    return NextResponse.json({ error: "getLpResult failed" }, { status: 500 });
  }

  // Verify GetLpResult ResponseCode
  if (lpResult.ResponseCode !== 0) {
    console.warn("[cardcom-webhook] GetLpResult returned non-zero", {
      orderId,
      code:        lpResult.ResponseCode,
      description: lpResult.Description,
    });
    await supabase
      .from("orders")
      .update({ payment_status: "failed", updated_at: now })
      .eq("id", orderId)
      .eq("payment_status", "pending");
    return NextResponse.json({ received: true });
  }

  // Verify ReturnValue matches our order
  if (lpResult.ReturnValue && lpResult.ReturnValue !== orderId) {
    console.error("[cardcom-webhook] GetLpResult ReturnValue mismatch", {
      expected: orderId,
      returned: lpResult.ReturnValue,
    });
    return NextResponse.json({ error: "return value mismatch" }, { status: 400 });
  }

  // Verify amount (5 agorot tolerance for rounding)
  const storedAmountShekels = order.total_agorot / 100;
  const returnedAmount      = lpResult.TranzactionInfo?.Amount;
  if (returnedAmount !== undefined) {
    if (Math.abs(returnedAmount - storedAmountShekels) > 0.05) {
      console.error("[cardcom-webhook] Amount mismatch", {
        stored:   storedAmountShekels,
        returned: returnedAmount,
        orderId,
      });
      return NextResponse.json({ error: "amount mismatch" }, { status: 400 });
    }
  }

  // Log LowProfileId mismatch as a warning but still accept (GetLpResult is authoritative)
  if (order.payment_reference && order.payment_reference !== lowProfileId) {
    console.warn("[cardcom-webhook] LowProfileId mismatch vs stored payment_reference", {
      stored:   order.payment_reference,
      received: lowProfileId,
      orderId,
    });
  }

  // ── Atomic update: only if still pending ──────────────────────────────────
  // Adding .eq("payment_status", "pending") makes this a compare-and-swap:
  // if two webhook calls race, only one gets rows back and sends the email.
  const { data: updated } = await supabase
    .from("orders")
    .update({
      payment_status:  "paid",
      order_status:    "confirmed",
      payment_reference: lowProfileId,
      payment_method:  "credit_card",
      updated_at:      now,
    })
    .eq("id", orderId)
    .eq("payment_status", "pending")
    .select("id");

  if (!updated || updated.length === 0) {
    // Another webhook call already processed this — nothing to do.
    console.log("[cardcom-webhook] Concurrent webhook: order already processed", { orderId });
    return NextResponse.json({ received: true });
  }

  console.log(`[cardcom-webhook] Order ${orderId} marked paid, LowProfileId=${lowProfileId}`);

  // ── Clear the user's DB cart ───────────────────────────────────────────────
  if (order.user_id) {
    const { error: cartError } = await supabase
      .from("user_cart_items")
      .delete()
      .eq("user_id", order.user_id);
    if (cartError) {
      // Non-fatal: order is confirmed, cart clear can be retried or is already empty.
      console.warn("[cardcom-webhook] Cart clear failed", {
        orderId,
        error: cartError.message,
      });
    }
  }

  // ── Send confirmation emails (fire-and-forget) ─────────────────────────────
  void sendOrderConfirmationEmails(orderId, supabase);

  return NextResponse.json({ received: true });
}

// ── Email helper ───────────────────────────────────────────────────────────────

type OrderItemSnapshot = {
  product_name: string;
  variant_label: string;
  price_agorot: number;
};

async function sendOrderConfirmationEmails(
  orderId: string,
  supabase: ReturnType<typeof getAdminSupabase>
) {
  try {
    const [{ data: order }, { data: orderItems }] = await Promise.all([
      supabase.from("orders").select("*").eq("id", orderId).single(),
      supabase.from("order_items").select("*").eq("order_id", orderId),
    ]);

    if (!order) return;

    const customer = order.customer_snapshot as {
      name?: string;
      email?: string;
      phone?: string;
    } | null;
    const address = order.delivery_address_snapshot as {
      street?: string;
      house_number?: string;
      apartment?: string | null;
      city?: string;
    } | null;

    if (!customer?.email) return;

    const emailData: OrderEmailData = {
      orderId:           order.id,
      orderNumber:       order.order_number,
      createdAt:         order.created_at,
      customerName:      customer.name ?? "",
      customerEmail:     customer.email,
      customerPhone:     customer.phone ?? "",
      addressStreet:     address?.street ?? "",
      addressHouseNumber: address?.house_number ?? "",
      addressApartment:  address?.apartment ?? null,
      addressCity:       address?.city ?? "",
      deliveryNotes:     order.delivery_notes ?? null,
      items: (orderItems ?? []).map((item) => {
        const snap = item.product_snapshot as unknown as OrderItemSnapshot;
        return {
          productName:      snap.product_name,
          variantLabel:     snap.variant_label,
          quantity:         item.quantity,
          unitPriceAgorot:  item.unit_price_agorot,
          totalPriceAgorot: item.total_price_agorot,
        };
      }),
      subtotalAgorot:    order.subtotal_agorot,
      deliveryFeeAgorot: order.delivery_fee_agorot,
      totalAgorot:       order.total_agorot,
      paymentMethod:     "credit_card",
      orderStatus:       "confirmed",
    };

    const [customerResult, adminResult] = await Promise.all([
      sendCustomerOrderConfirmation(emailData),
      sendAdminNewOrderNotification(emailData),
    ]);

    if (!customerResult.ok) {
      console.error("[cardcom-webhook] Customer email failed", {
        orderId,
        error: customerResult.error,
      });
    }
    if (!adminResult.ok) {
      console.error("[cardcom-webhook] Admin email failed", {
        orderId,
        error: adminResult.error,
      });
    }
  } catch (e) {
    console.error("[cardcom-webhook] Email sending threw", e);
  }
}
