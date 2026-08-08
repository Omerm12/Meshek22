/**
 * Shared Cardcom payment verification and finalization module.
 *
 * Single source of truth for the "verify Cardcom payment → mark order paid →
 * clear cart → send emails" pipeline. Both the webhook handler and admin/manual
 * recovery call this function so the exact same validation rules apply.
 *
 * Idempotency contract:
 * - Safe to call multiple times for the same order.
 * - "already_paid" is returned immediately if the order is already paid.
 * - Email sending uses atomic DB flags (customer_email_sent_at /
 *   admin_email_sent_at). Only the process that wins the UPDATE … WHERE IS NULL
 *   race actually sends; others skip silently.
 * - Cart clearing is protected by the CAS update: if the CAS returns 0 rows
 *   another caller already finalized the order, so we skip cart + emails.
 *
 * Recovery semantics:
 * - Call verifyAndFinalizeCardcomPayment(orderId, storedPaymentReference) to
 *   replay finalization for a paid-but-not-finalized order (e.g. server crash
 *   after webhook marked the order paid but before emails were sent).
 * - Call recoverPaymentByOrderId(orderId) to re-run the full pipeline using
 *   the LowProfileId that is already stored on the order.
 *
 * Emails are sent from OUR app only, never from Cardcom.
 * Cart is cleared only after verified successful payment.
 * No side effects happen on failed, pending, or cancelled payments.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { getLpResult } from "@/lib/cardcom";
import { sendOrderEmails } from "@/lib/email/order-emails";

// ── Types ──────────────────────────────────────────────────────────────────────

function makeAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Missing Supabase admin credentials");
  return createClient<Database>(url, key);
}

type AdminClient = ReturnType<typeof makeAdminClient>;

export type FinalizeResult =
  | { outcome: "paid" }
  | { outcome: "already_paid" }
  | { outcome: "failed"; reason: string }
  | { outcome: "blocked"; reason: string }
  | { outcome: "transient_error"; reason: string };

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Verifies a Cardcom payment via GetLpResult and, if all checks pass,
 * atomically marks the order paid, clears the cart, and sends confirmation
 * emails from our app.
 *
 * @param orderId             Our internal order UUID (= ReturnValue set at session creation).
 * @param incomingLowProfileId The LowProfileId to verify. For the webhook this is
 *                            the value Cardcom POSTed. For manual recovery pass the
 *                            stored order.payment_reference.
 * @param client              Optional pre-created admin client (avoids an extra
 *                            client instantiation when called from the webhook).
 */
export async function verifyAndFinalizeCardcomPayment(
  orderId: string,
  incomingLowProfileId: string,
  client?: AdminClient
): Promise<FinalizeResult> {
  const db  = client ?? makeAdminClient();
  const now = new Date().toISOString();
  const ctx = { orderId, lowProfileId: incomingLowProfileId };

  console.log("[cardcom:finalize]", { event: "verify_start", ...ctx });

  // ── Fetch order ──────────────────────────────────────────────────────────
  const { data: order, error: fetchErr } = await db
    .from("orders")
    .select("id, user_id, total_agorot, payment_status, payment_reference, customer_email_sent_at, admin_email_sent_at")
    .eq("id", orderId)
    .single();

  if (fetchErr || !order) {
    console.error("[cardcom:finalize]", { event: "order_not_found", ...ctx, error: fetchErr?.message });
    return { outcome: "blocked", reason: "order_not_found" };
  }

  // ── Idempotency ──────────────────────────────────────────────────────────
  if (order.payment_status === "paid") {
    console.log("[cardcom:finalize]", { event: "already_paid", ...ctx });
    // Crash-after-pay recovery: if the process died between the CAS and email
    // sending, send the missing emails now.
    if (!order.customer_email_sent_at || !order.admin_email_sent_at) {
      console.log("[cardcom:finalize]", { event: "email_recovery_start", ...ctx });
      void sendOrderEmails(orderId, db);
    }
    return { outcome: "already_paid" };
  }

  // ── GetLpResult ──────────────────────────────────────────────────────────
  console.log("[cardcom:finalize]", { event: "getLpResult_start", ...ctx });

  let lp: Awaited<ReturnType<typeof getLpResult>>;
  try {
    lp = await getLpResult(incomingLowProfileId);
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.error("[cardcom:finalize]", { event: "getLpResult_error", ...ctx, reason });
    return { outcome: "transient_error", reason };
  }

  console.log("[cardcom:finalize]", {
    event: "getLpResult_response",
    ...ctx,
    rc:             lp.ResponseCode,
    description:    lp.Description,
    approvalNumber: lp.TranzactionInfo?.ApprovalNumber,
    returnedAmount: lp.TranzactionInfo?.Amount,
    returnedTerminal: lp.TerminalNumber,
  });

  // ── ResponseCode ─────────────────────────────────────────────────────────
  if (lp.ResponseCode !== 0) {
    console.log("[cardcom:finalize]", {
      event: "payment_failed",
      ...ctx,
      rc:          lp.ResponseCode,
      description: lp.Description,
    });
    await db
      .from("orders")
      .update({ payment_status: "failed", updated_at: now })
      .eq("id", orderId)
      .eq("payment_status", "pending");
    return { outcome: "failed", reason: `ResponseCode=${lp.ResponseCode}: ${lp.Description ?? ""}` };
  }

  // ── TerminalNumber mismatch (GetLpResult response) ───────────────────────
  // A second layer of terminal verification against the authoritative Cardcom
  // response, independent of the webhook payload.
  const expectedTerminal = process.env.CARDCOM_TERMINAL_NUMBER ?? "";
  const returnedTerminal = lp.TerminalNumber != null ? String(lp.TerminalNumber) : null;
  if (expectedTerminal && returnedTerminal && returnedTerminal !== expectedTerminal) {
    console.error("[cardcom:finalize]", {
      event: "terminal_mismatch",
      ...ctx,
      expected: expectedTerminal,
      received: returnedTerminal,
    });
    return { outcome: "blocked", reason: "terminal_mismatch" };
  }

  // ── ReturnValue mismatch ─────────────────────────────────────────────────
  if (lp.ReturnValue && lp.ReturnValue !== orderId) {
    console.error("[cardcom:finalize]", {
      event: "return_value_mismatch",
      ...ctx,
      expected: orderId,
      received: lp.ReturnValue,
    });
    return { outcome: "blocked", reason: "return_value_mismatch" };
  }

  // ── Amount mismatch ──────────────────────────────────────────────────────
  // 5 agorot tolerance for floating-point rounding at the shekel boundary.
  const storedShekels   = order.total_agorot / 100;
  const returnedAmount  = lp.TranzactionInfo?.Amount;
  if (returnedAmount !== undefined && Math.abs(returnedAmount - storedShekels) > 0.05) {
    console.error("[cardcom:finalize]", {
      event: "amount_mismatch",
      ...ctx,
      storedShekels,
      returnedShekels: returnedAmount,
    });
    return { outcome: "blocked", reason: "amount_mismatch" };
  }

  // ── LowProfileId mismatch ────────────────────────────────────────────────
  // The LowProfileId stored on the order (set when we created the Cardcom session)
  // must match the incoming one. A mismatch means a different session is being
  // applied to this order — reject it.
  // Note: for manual recovery, incomingLowProfileId IS the stored reference, so
  // this check always passes in that case.
  if (order.payment_reference && order.payment_reference !== incomingLowProfileId) {
    console.error("[cardcom:finalize]", {
      event: "low_profile_id_mismatch",
      ...ctx,
      storedReference: order.payment_reference,
    });
    return { outcome: "blocked", reason: "low_profile_id_mismatch" };
  }

  // ── All checks passed ────────────────────────────────────────────────────
  const approvalNumber = lp.TranzactionInfo?.ApprovalNumber ?? null;

  console.log("[cardcom:finalize]", {
    event: "payment_verified",
    ...ctx,
    approvalNumber: approvalNumber ?? "n/a",
    storedShekels,
  });

  // ── Atomic CAS: pending/failed → paid ────────────────────────────────────
  // Using .in(["pending","failed"]) instead of .eq("pending") lets a retry
  // succeed after an earlier attempt left the order in "failed" state.
  const { data: updated } = await db
    .from("orders")
    .update({
      payment_status:          "paid",
      order_status:            "confirmed",
      payment_reference:       incomingLowProfileId,
      payment_method:          "credit_card",
      cardcom_approval_number: approvalNumber,
      payment_metadata:        lp as unknown as Json,
      updated_at:              now,
    })
    .eq("id", orderId)
    .in("payment_status", ["pending", "failed"])
    .select("id");

  if (!updated || updated.length === 0) {
    // A concurrent call already finalized this order — idempotent no-op.
    console.log("[cardcom:finalize]", { event: "cas_missed_concurrent_finalized", ...ctx });
    return { outcome: "already_paid" };
  }

  // ── Cart ─────────────────────────────────────────────────────────────────
  // A guest cart lives in the customer's own localStorage, so there is nothing
  // to delete server-side. The browser empties it on the success page, which
  // only renders after this function has marked the order paid — so a failed or
  // cancelled payment still leaves the basket intact.
  //
  // Legacy orders placed by a signed-in customer (before customer accounts were
  // removed) may still have server-side cart rows; clear those, scoped strictly
  // to the order's own user_id — never a broad delete.
  if (order.user_id) {
    const { error: cartErr } = await db
      .from("user_cart_items")
      .delete()
      .eq("user_id", order.user_id);   // scoped: only this user's cart items

    if (cartErr) {
      console.warn("[cardcom:finalize]", { event: "cart_clear_failed", ...ctx, error: cartErr.message });
    } else {
      console.log("[cardcom:finalize]", { event: "cart_cleared", ...ctx, userId: order.user_id });
    }
  }

  // ── Send confirmation emails (fire-and-forget) ───────────────────────────
  // Emails are sent from OUR app only — never from Cardcom.
  // sendOrderEmails uses atomic DB locks to prevent duplicates, and is shared
  // with the offline (cash / phone-credit) checkout path.
  void sendOrderEmails(orderId, db);

  return { outcome: "paid" };
}

/**
 * Convenience wrapper for admin/manual recovery.
 * Looks up the stored LowProfileId from the order and re-runs the full
 * verification pipeline. Safe to call on any order in any state.
 *
 * Usage (e.g. from a one-off script or admin API route):
 *   const result = await recoverPaymentByOrderId("order-uuid-here");
 */
export async function recoverPaymentByOrderId(orderId: string): Promise<FinalizeResult> {
  const db = makeAdminClient();

  const { data: order, error } = await db
    .from("orders")
    .select("payment_reference")
    .eq("id", orderId)
    .single();

  if (error || !order?.payment_reference) {
    console.error("[cardcom:finalize]", {
      event: "recovery_no_payment_reference",
      orderId,
      error: error?.message,
    });
    return { outcome: "blocked", reason: "no_payment_reference" };
  }

  return verifyAndFinalizeCardcomPayment(orderId, order.payment_reference, db);
}
