/**
 * CardCom Low Profile webhook endpoint.
 *
 * CardCom sends a POST to this URL when a payment is approved, declined, or cancelled.
 * This is the ONLY place where orders are marked as paid — never trust the user's
 * success redirect URL alone, as it can be manually visited without completing payment.
 *
 * Configuration:
 *   CARDCOM_TERMINAL_NUMBER  — used to verify the callback is from our terminal
 *   SUPABASE_SERVICE_ROLE_KEY — for admin DB writes bypassing RLS
 *
 * In the CardCom dashboard, set the webhook URL to:
 *   https://yourdomain.co.il/api/cardcom/callback
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  sendCustomerOrderConfirmation,
  sendAdminNewOrderNotification,
} from "@/lib/email/service";
import type { OrderEmailData } from "@/lib/email/types";

export const runtime = "nodejs";

type OrderUpdate = Database["public"]["Tables"]["orders"]["Update"];

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Missing Supabase admin credentials");
  return createClient<Database>(url, key);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // CardCom sends form-encoded or JSON POST depending on configuration.
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

  const responseCode = parseInt(params["ResponseCode"] ?? "-1", 10);
  const lowProfileId = params["LowProfileId"] ?? "";
  // ReturnValue is set to the order UUID when creating the CardCom session.
  const orderId = params["ReturnValue"] ?? "";
  const terminalNumber = params["TerminalNumber"] ?? "";
  const approvalNumber = params["ApprovalNumber"] ?? null;

  // Basic sanity check — reject callbacks for unknown terminals.
  const expectedTerminal = process.env.CARDCOM_TERMINAL_NUMBER ?? "";
  if (expectedTerminal && terminalNumber && terminalNumber !== expectedTerminal) {
    console.warn("[cardcom-webhook] Terminal mismatch — ignoring callback", {
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

  let orderUpdate: OrderUpdate;

  if (responseCode === 0) {
    orderUpdate = {
      payment_status: "paid",
      order_status: "confirmed",
      payment_reference: lowProfileId || null,
      payment_method: "credit_card",
      updated_at: now,
    };
  } else {
    orderUpdate = {
      payment_status: "failed",
      updated_at: now,
    };
    console.log(`[cardcom-webhook] Payment failed for order ${orderId}, code=${responseCode}`);
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update(orderUpdate)
    .eq("id", orderId);

  if (updateError) {
    console.error("[cardcom-webhook] DB update failed", { orderId, error: updateError.message });
    // Return 500 so CardCom retries the webhook.
    return NextResponse.json({ error: "db update failed" }, { status: 500 });
  }

  console.log(
    `[cardcom-webhook] Order ${orderId} updated: payment_status=${orderUpdate.payment_status}` +
      (approvalNumber ? `, approval=${approvalNumber}` : "")
  );

  // Send confirmation emails after successful payment — fire-and-forget.
  if (responseCode === 0) {
    void sendOrderConfirmationEmails(orderId, supabase);
  }

  // CardCom expects HTTP 200 to confirm receipt.
  return NextResponse.json({ received: true });
}

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
    // Fetch order and order_items separately — Supabase types do not expose a
    // direct FK relation between orders and order_items for nested select.
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
      orderId: order.id,
      orderNumber: order.order_number,
      createdAt: order.created_at,
      customerName: customer.name ?? "",
      customerEmail: customer.email,
      customerPhone: customer.phone ?? "",
      addressStreet: address?.street ?? "",
      addressHouseNumber: address?.house_number ?? "",
      addressApartment: address?.apartment ?? null,
      addressCity: address?.city ?? "",
      deliveryNotes: order.delivery_notes ?? null,
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
