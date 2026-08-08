/**
 * Order confirmation emails — one idempotent sender for every payment method.
 *
 * Idempotency is enforced in the database rather than in memory: each email
 * claims its slot with
 *
 *   UPDATE orders SET <flag> = now() WHERE id = $1 AND <flag> IS NULL RETURNING id
 *
 * Exactly one caller can win that update. Everyone else gets zero rows and skips
 * silently, so a webhook retry, a crash-recovery replay and an offline-order
 * creation racing each other still produce a single email. If sending fails the
 * flag is reset so a later attempt can retry.
 *
 * Called from two places:
 *   • cardcomFinalize — after an online payment is verified
 *   • the checkout Server Action — immediately after an offline (cash /
 *     phone-credit) order is created, since there is no webhook to wait for.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  sendAdminNewOrderNotification,
  sendCustomerOrderConfirmation,
} from "@/lib/email/service";
import type { OrderEmailData } from "@/lib/email/types";

type AdminClient = SupabaseClient<Database>;

type OrderItemSnapshot = {
  product_name: string;
  variant_label: string;
  price_agorot: number;
};

/**
 * Build the email payload from the stored order and send both messages.
 * Never throws: email delivery must not roll back a paid or accepted order.
 */
export async function sendOrderEmails(orderId: string, db: AdminClient): Promise<void> {
  try {
    const [{ data: order }, { data: items }] = await Promise.all([
      db.from("orders").select("*").eq("id", orderId).single(),
      db.from("order_items").select("*").eq("order_id", orderId),
    ]);

    if (!order) return;

    const customer = order.customer_snapshot as
      | { name?: string; email?: string; phone?: string }
      | null;
    const address = order.delivery_address_snapshot as
      | { street?: string; house_number?: string; apartment?: string | null; city?: string }
      | null;

    // A customer without an email (cash and pickup orders do not require one)
    // must not cost the shop its own notification — the admin email is what
    // tells them to start packing. Only the customer half is skipped below.
    const hasCustomerEmail = !!customer?.email;

    const emailData: OrderEmailData = {
      orderId:            order.id,
      orderNumber:        order.order_number,
      createdAt:          order.created_at,
      customerName:       customer?.name ?? "",
      customerEmail:      customer?.email ?? "",
      customerPhone:      customer?.phone ?? "",
      addressStreet:      address?.street ?? "",
      addressHouseNumber: address?.house_number ?? "",
      addressApartment:   address?.apartment ?? null,
      addressCity:        address?.city ?? "",
      deliveryNotes:      order.delivery_notes ?? null,
      items: (items ?? []).map((item) => {
        const snap = item.product_snapshot as unknown as OrderItemSnapshot;
        return {
          productName:      snap.product_name,
          variantLabel:     snap.variant_label,
          quantity:         item.quantity,
          unitPriceAgorot:  item.unit_price_agorot,
          // Show the amount actually charged for the line, promotion included.
          totalPriceAgorot: item.total_price_agorot - (item.discount_agorot ?? 0),
        };
      }),
      subtotalAgorot:    order.subtotal_agorot,
      deliveryFeeAgorot: order.delivery_fee_agorot,
      discountAgorot:    order.discount_agorot ?? 0,
      totalAgorot:       order.total_agorot,
      fulfillmentMethod: order.fulfillment_method ?? "delivery",
      paymentMethod:     order.payment_method,
      orderStatus:       order.order_status,
    };

    const now = new Date().toISOString();
    const ctx = { orderId };

    // ── Customer email — atomic claim via DB flag ────────────────────────────
    //
    // When there is no address to send to, the slot is still claimed and NOTHING
    // is sent. The flag means "the customer-email step is resolved", not "a
    // message went out" — without this an order with no email leaves the flag
    // NULL forever, and cardcomFinalize's crash-recovery check
    // (`!customer_email_sent_at || !admin_email_sent_at`) would re-enter this
    // function on every subsequent webhook retry, indefinitely.
    if (!hasCustomerEmail) {
      await db
        .from("orders")
        .update({ customer_email_sent_at: now })
        .eq("id", orderId)
        .is("customer_email_sent_at", null);
      console.log("[order-emails]", {
        event: "customer_email_skipped_no_address",
        orderId,
      });
    }

    const { data: custLock } = hasCustomerEmail
      ? await db
          .from("orders")
          .update({ customer_email_sent_at: now })
          .eq("id", orderId)
          .is("customer_email_sent_at", null)
          .select("id")
      : { data: null };

    if (custLock && custLock.length > 0) {
      const res = await sendCustomerOrderConfirmation(emailData);
      if (!res.ok) {
        // Reset the flag so a later attempt can retry.
        await db.from("orders").update({ customer_email_sent_at: null }).eq("id", orderId);
        console.error("[order-emails]", { event: "customer_email_failed", ...ctx, error: res.error });
      } else {
        console.log("[order-emails]", { event: "customer_email_sent", ...ctx });
      }
    }

    // ── Admin email — atomic claim via DB flag ───────────────────────────────
    const { data: adminLock } = await db
      .from("orders")
      .update({ admin_email_sent_at: now })
      .eq("id", orderId)
      .is("admin_email_sent_at", null)
      .select("id");

    if (adminLock && adminLock.length > 0) {
      const res = await sendAdminNewOrderNotification(emailData);
      if (!res.ok) {
        await db.from("orders").update({ admin_email_sent_at: null }).eq("id", orderId);
        console.error("[order-emails]", { event: "admin_email_failed", ...ctx, error: res.error });
      } else {
        console.log("[order-emails]", { event: "admin_email_sent", ...ctx });
      }
    }
  } catch (e) {
    console.error("[order-emails]", { event: "email_threw", orderId, error: e });
  }
}
