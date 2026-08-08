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
      // Awaited, not fire-and-forget: on a serverless platform the function may
      // be frozen the instant the response is returned, silently dropping an
      // untracked promise. sendOrderEmails never throws, so awaiting cannot fail
      // the webhook — it only delays the 200 by the send.
      await sendOrderEmails(orderId, db);
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

  // Every check below REQUIRES its field to be present. A missing verification
  // field previously skipped the check silently, so a response that simply
  // omitted TerminalNumber, ReturnValue or Amount was treated as fully verified.
  // Absent evidence is now "blocked", never "approved".

  // ── TerminalNumber ───────────────────────────────────────────────────────
  // Must be configured AND returned AND equal. An unset env var is a deployment
  // fault; failing closed is the only safe reading for money.
  const expectedTerminal = process.env.CARDCOM_TERMINAL_NUMBER ?? "";
  if (!expectedTerminal) {
    console.error("[cardcom:finalize]", { event: "terminal_not_configured", ...ctx });
    return { outcome: "blocked", reason: "terminal_not_configured" };
  }

  const returnedTerminal = lp.TerminalNumber != null ? String(lp.TerminalNumber) : null;
  if (!returnedTerminal) {
    console.error("[cardcom:finalize]", { event: "terminal_missing_in_response", ...ctx });
    return { outcome: "blocked", reason: "terminal_missing" };
  }
  if (returnedTerminal !== expectedTerminal) {
    console.error("[cardcom:finalize]", {
      event: "terminal_mismatch",
      ...ctx,
      expected: expectedTerminal,
      received: returnedTerminal,
    });
    return { outcome: "blocked", reason: "terminal_mismatch" };
  }

  // ── ReturnValue ──────────────────────────────────────────────────────────
  // This is what ties the CardCom session to OUR order. Without it there is no
  // evidence the payment belongs to this order at all.
  if (!lp.ReturnValue) {
    console.error("[cardcom:finalize]", { event: "return_value_missing", ...ctx });
    return { outcome: "blocked", reason: "return_value_missing" };
  }
  if (lp.ReturnValue !== orderId) {
    console.error("[cardcom:finalize]", {
      event: "return_value_mismatch",
      ...ctx,
      expected: orderId,
      received: lp.ReturnValue,
    });
    return { outcome: "blocked", reason: "return_value_mismatch" };
  }

  // ── Amount ───────────────────────────────────────────────────────────────
  // Must be present and finite. 5 agorot tolerance for floating-point rounding
  // at the shekel boundary.
  const storedShekels  = order.total_agorot / 100;
  const returnedAmount = lp.TranzactionInfo?.Amount;
  if (typeof returnedAmount !== "number" || !Number.isFinite(returnedAmount)) {
    console.error("[cardcom:finalize]", {
      event: "amount_missing",
      ...ctx,
      received: returnedAmount,
    });
    return { outcome: "blocked", reason: "amount_missing" };
  }
  if (Math.abs(returnedAmount - storedShekels) > 0.05) {
    console.error("[cardcom:finalize]", {
      event: "amount_mismatch",
      ...ctx,
      storedShekels,
      returnedShekels: returnedAmount,
    });
    return { outcome: "blocked", reason: "amount_mismatch" };
  }

  // ── LowProfileId ─────────────────────────────────────────────────────────
  // The session stored on the order (set when we created it) must match the
  // incoming one, and — when CardCom echoes it — the authoritative response too.
  // A mismatch means a different session is being applied to this order.
  // Note: for manual recovery, incomingLowProfileId IS the stored reference, so
  // the first check always passes in that case.
  if (order.payment_reference && order.payment_reference !== incomingLowProfileId) {
    console.error("[cardcom:finalize]", {
      event: "low_profile_id_mismatch",
      ...ctx,
      storedReference: order.payment_reference,
    });
    return { outcome: "blocked", reason: "low_profile_id_mismatch" };
  }
  if (lp.LowProfileId && lp.LowProfileId !== incomingLowProfileId) {
    console.error("[cardcom:finalize]", {
      event: "low_profile_id_response_mismatch",
      ...ctx,
      responseLowProfileId: lp.LowProfileId,
    });
    return { outcome: "blocked", reason: "low_profile_id_response_mismatch" };
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
  const { data: updated, error: casError } = await db
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

  // A database failure must NOT be mistaken for "someone else already finalized
  // it" — that would swallow the error, skip the emails and leave a paid customer
  // with an unpaid order. Reported as transient so CardCom retries the webhook.
  if (casError) {
    console.error("[cardcom:finalize]", {
      event: "cas_update_failed",
      ...ctx,
      code: casError.code,
      message: casError.message,
      details: casError.details,
      hint: casError.hint,
    });
    return { outcome: "transient_error", reason: "cas_update_failed" };
  }

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
  //
  // Awaited for the same reason as above: a fire-and-forget promise is not safe
  // in a serverless request, where the runtime may suspend as soon as the
  // webhook responds. The order is already marked paid at this point, so a slow
  // or failing send cannot affect the payment outcome.
  await sendOrderEmails(orderId, db);

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
