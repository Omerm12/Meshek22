import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * CardCom verification and the removal of the obsolete PayPlus webhook.
 *
 * The finalizer talks to CardCom over the network and writes to Supabase, so
 * these tests assert the properties by reading the source: which checks exist,
 * that none of them is optional, and that the vulnerable route is gone. Each one
 * corresponds to a way money or order state could previously be forged.
 */
const finalize = readFileSync("src/lib/payment/cardcomFinalize.ts", "utf8");
const callback = readFileSync("src/app/api/cardcom/callback/route.ts", "utf8");
const checkoutActions = readFileSync("src/app/(shop)/checkout/actions.ts", "utf8");
const adminOrderActions = readFileSync(
  "src/app/meshek22-control/(protected)/orders/actions.ts",
  "utf8"
);

// ─── 1. PayPlus webhook removal ───────────────────────────────────────────────

describe("obsolete PayPlus webhook", () => {
  it("no longer exists as a route", () => {
    expect(() => readFileSync("src/app/api/payment/webhook/route.ts", "utf8")).toThrow();
  });

  it("has no PayPlus client module left behind", () => {
    expect(() => readFileSync("src/lib/payment/payplus.ts", "utf8")).toThrow();
  });

  it("is not referenced anywhere in the application", async () => {
    const { readdirSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");

    const walk = (dir: string, out: string[] = []): string[] => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (/\.tsx?$/.test(full)) out.push(full);
      }
      return out;
    };

    // Application code only. Tests legitimately name PayPlus in order to assert
    // that it is gone, and a test cannot reintroduce the route.
    const offenders = walk("src").filter(
      (f) => !/\.test\.tsx?$/.test(f) && /payplus/i.test(readFileSync(f, "utf8"))
    );
    expect(offenders).toEqual([]);
  });

  it("left the active CardCom route in place", () => {
    expect(callback).toContain("verifyAndFinalizeCardcomPayment");
  });
});

// ─── 2. Verification completeness ─────────────────────────────────────────────

describe("CardCom finalization requires every field", () => {
  it("keeps GetLpResult as the authoritative source", () => {
    expect(finalize).toContain("getLpResult(incomingLowProfileId)");
  });

  it("blocks when the terminal is unconfigured, missing or mismatched", () => {
    expect(finalize).toContain('reason: "terminal_not_configured"');
    expect(finalize).toContain('reason: "terminal_missing"');
    expect(finalize).toContain('reason: "terminal_mismatch"');
  });

  it("blocks when ReturnValue is absent, not just when it differs", () => {
    // Previously `if (lp.ReturnValue && ...)` — an omitted field skipped the
    // check entirely and the payment was treated as verified.
    expect(finalize).toContain('reason: "return_value_missing"');
    expect(finalize).toContain('reason: "return_value_mismatch"');
    expect(finalize).not.toContain("if (lp.ReturnValue && lp.ReturnValue !== orderId)");
  });

  it("blocks when the amount is absent or not a finite number", () => {
    expect(finalize).toContain('reason: "amount_missing"');
    expect(finalize).toContain("Number.isFinite(returnedAmount)");
    expect(finalize).toContain('reason: "amount_mismatch"');
  });

  it("compares whole agorot, never a floating-point shekel value directly", () => {
    // A shekel-level tolerance (e.g. comparing to within 0.05) would let an
    // amount off by several agorot through. CardCom's decimal shekels are
    // rounded to the nearest agora and compared as integers instead.
    expect(finalize).toContain("Math.round(returnedAmount * 100)");
    expect(finalize).toContain("verifiedAgorot !== order.total_agorot");
    expect(finalize).not.toMatch(/Math\.abs\([^)]*\)\s*>\s*0\.05/);
  });

  it("checks the session against both the stored and the returned LowProfileId", () => {
    expect(finalize).toContain('reason: "low_profile_id_mismatch"');
    expect(finalize).toContain('reason: "low_profile_id_response_mismatch"');
  });

  it("requires ChargeOnly and a clean, present TranzactionInfo", () => {
    expect(finalize).toContain('reason: "operation_mismatch"');
    expect(finalize).toContain('reason: "tranzaction_info_missing"');
    expect(finalize).toContain('reason: "tranzaction_response_code_mismatch"');
    expect(finalize).toContain('reason: "tranzaction_id_missing"');
    expect(finalize).toContain('reason: "coin_id_mismatch"');
    expect(finalize).toContain('reason: "is_refund"');
  });

  it("never treats a missing field as success", () => {
    // Every guard above returns blocked; none falls through to the CAS.
    const blockedCount = (finalize.match(/outcome: "blocked"/g) ?? []).length;
    expect(blockedCount).toBeGreaterThanOrEqual(15);
  });
});

// ─── 3. Database failure handling ─────────────────────────────────────────────

describe("compare-and-set", () => {
  it("distinguishes a database error from a concurrent finalization", () => {
    // Swallowing the error would report already_paid, skip the emails and leave
    // a charged customer with an unpaid order.
    expect(finalize).toContain("error: casError");
    expect(finalize).toContain('event: "cas_update_failed"');
    expect(finalize).toContain('reason: "cas_update_failed"');
  });

  it("asks CardCom to retry on a database failure", () => {
    const idx = finalize.indexOf("cas_update_failed");
    const after = finalize.slice(idx, idx + 400);
    expect(after).toContain("transient_error");
  });

  it("still reports a genuine concurrent finalization as idempotent", () => {
    expect(finalize).toContain("cas_missed_concurrent_finalized");
    expect(finalize).toContain('outcome: "already_paid"');
  });
});

// ─── 4. Forged failure notification ───────────────────────────────────────────

describe("reported failures are verified, not trusted", () => {
  it("does not write payment_status directly from the webhook payload", () => {
    // The old fast path let anyone who learned an order id POST
    // {"ReturnValue": id, "ResponseCode": 1} and fail a real pending payment.
    expect(callback).not.toContain('.update({ payment_status: "failed"');
  });

  it("routes a reported failure through the same authoritative verification", () => {
    const idx = callback.indexOf("payment_failure_reported");
    expect(idx).toBeGreaterThan(-1);
    const branch = callback.slice(idx, idx + 900);
    expect(branch).toContain("verifyAndFinalizeCardcomPayment");
  });

  it("writes nothing at all when there is no session to verify against", () => {
    expect(callback).toContain("failure_without_session");
  });

  it("keeps the terminal check on the webhook payload as a first layer", () => {
    expect(callback).toContain("terminal_mismatch");
  });
});

// ─── 5. Email delivery safety ─────────────────────────────────────────────────

describe("email delivery from the webhook", () => {
  it("awaits the send instead of leaking an untracked promise", () => {
    // A serverless runtime may freeze the moment the response is returned,
    // silently dropping `void somePromise()`.
    expect(finalize).not.toContain("void sendOrderEmails");
    expect(finalize).toContain("await sendOrderEmails(orderId, db)");
  });
});

// ─── 6. JSON webhook values are normalized before comparison ──────────────────

describe("JSON webhook body parsing", () => {
  it("stringifies every parsed value instead of trusting the declared type", () => {
    // CardCom's webhook is Content-Type: application/json, so TerminalNumber
    // arrives as a JSON number. The route's params variable was declared
    // Record<string, string> but JSON.parse does not enforce that at runtime —
    // an unnormalized `172204100 !== "172204100"` is always true regardless of
    // the actual terminal number, which made every real webhook look like a
    // mismatch (see route.test.ts for the behavioural proof).
    expect(callback).toContain("v == null ? \"\" : String(v)");
  });
});

// ─── 7. Polling fallback reconciles a missed webhook ──────────────────────────

describe("the success-page poll is not just a Supabase read", () => {
  it("calls the shared verification function when still pending", () => {
    const idx = checkoutActions.indexOf("getGuestOrderStatus");
    expect(idx).toBeGreaterThan(-1);
    expect(checkoutActions).toContain("verifyAndFinalizeCardcomPayment(data.id, data.payment_reference, db)");
  });

  it("only reconciles pending online-card orders with a stored session", () => {
    const idx = checkoutActions.indexOf('data.payment_status === "pending"');
    expect(idx).toBeGreaterThan(-1);
    const branch = checkoutActions.slice(idx, idx + 200);
    expect(branch).toContain('data.payment_method === "credit_card"');
    expect(branch).toContain("data.payment_reference");
  });
});

// ─── 8. Admin manual recovery uses the same verified pipeline ─────────────────

describe("the admin 'recheck with CardCom' action", () => {
  it("delegates to recoverPaymentByOrderId instead of writing payment_status directly", () => {
    expect(adminOrderActions).toContain(
      'import { recoverPaymentByOrderId } from "@/lib/payment/cardcomFinalize"'
    );
    const idx = adminOrderActions.indexOf("isCardcomRecheckAction(transitionAction)");
    expect(idx).toBeGreaterThan(-1);
    const branch = adminOrderActions.slice(idx, idx + 900);
    expect(branch).toContain("recoverPaymentByOrderId(orderId)");
    // Every outcome is mapped explicitly; none silently marks the order paid.
    expect(branch).toContain('case "paid":');
    expect(branch).toContain('case "already_paid":');
    expect(branch).toContain('case "failed":');
    expect(branch).toContain('case "blocked":');
    expect(branch).toContain('case "transient_error":');
  });

  it("runs before the generic CAS-write transition logic", () => {
    const rechecklndex = adminOrderActions.indexOf("isCardcomRecheckAction(transitionAction)");
    const resolveIndex = adminOrderActions.indexOf("resolveTransition(transitionAction, ctx)");
    expect(rechecklndex).toBeGreaterThan(-1);
    expect(resolveIndex).toBeGreaterThan(-1);
    expect(rechecklndex).toBeLessThan(resolveIndex);
  });
});
