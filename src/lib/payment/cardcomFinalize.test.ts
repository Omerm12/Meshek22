import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Behavioural coverage for the shared CardCom verification/finalization
 * pipeline. `getLpResult` (network) and `sendOrderEmails` (Resend) are
 * stubbed; everything else — the verification checks, the compare-and-set,
 * the idempotency short-circuit — runs for real against a small in-memory
 * "orders" table.
 *
 * Companion to cardcom-verification.test.ts, which asserts on the source text
 * for properties that are awkward to exercise behaviourally (e.g. "every
 * guard returns before the CAS, none falls through").
 */

const ORDER_ID = "785c9e89-ab1f-489d-842e-25de20abe12d";
const LOW_PROFILE_ID = "f3dbb871-b082-4aa9-bb86-3a6caa6c9bbe";
const TERMINAL = "172204100";

const { getLpResult, sendOrderEmails } = vi.hoisted(() => ({
  getLpResult: vi.fn(),
  sendOrderEmails: vi.fn(async () => {}),
}));

vi.mock("@/lib/cardcom", () => ({ getLpResult }));
vi.mock("@/lib/email/order-emails", () => ({ sendOrderEmails }));

import { verifyAndFinalizeCardcomPayment } from "@/lib/payment/cardcomFinalize";

// ─── Fake Supabase "orders" / "user_cart_items" tables ────────────────────────
//
// A single mutable row, manipulated through the same chained calls the real
// module makes. Filters are evaluated against the row's CURRENT fields at the
// moment each call runs, so a CAS whose expected status no longer matches
// behaves exactly like Postgres returning zero rows.

type Row = Record<string, unknown>;
type Filter = { col: string; op: "eq" | "in" | "is"; val: unknown };

function evalFilters(state: Row, filters: Filter[]): boolean {
  return filters.every((f) => {
    const current = state[f.col];
    if (f.op === "in") return (f.val as unknown[]).includes(current);
    return current === f.val;
  });
}

function builder(state: Row, mode: "select" | "update" | "delete", patch?: Row) {
  const filters: Filter[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const api: any = {
    eq(col: string, val: unknown) {
      filters.push({ col, op: "eq", val });
      return api;
    },
    in(col: string, val: unknown[]) {
      filters.push({ col, op: "in", val });
      return api;
    },
    is(col: string, val: unknown) {
      filters.push({ col, op: "is", val });
      return api;
    },
    // Chained AFTER update(): finalize now, applying the patch only if the
    // row still matches every filter — this is the CAS.
    select() {
      const matched = evalFilters(state, filters);
      if (matched && mode === "update" && patch) Object.assign(state, patch);
      return Promise.resolve({ data: matched ? [{ ...state }] : [], error: null });
    },
    async single() {
      const matched = evalFilters(state, filters);
      return matched
        ? { data: { ...state }, error: null }
        : { data: null, error: { message: "not found", code: "PGRST116" } };
    },
    async maybeSingle() {
      const matched = evalFilters(state, filters);
      return { data: matched ? { ...state } : null, error: null };
    },
    // Awaited directly with no trailing .select() (the ResponseCode!=0 fast
    // path and the cart-clear delete).
    then(onFulfilled: (v: { data: null; error: null }) => unknown) {
      const matched = evalFilters(state, filters);
      if (matched && mode === "update" && patch) Object.assign(state, patch);
      return Promise.resolve({ data: null, error: null }).then(onFulfilled);
    },
  };
  return api;
}

function makeDb(row: Row) {
  const state = { ...row };
  return {
    state,
    from(table: string) {
      if (table === "orders") {
        return {
          select: () => builder(state, "select"),
          update: (patch: Row) => builder(state, "update", patch),
        };
      }
      if (table === "user_cart_items") {
        return { delete: () => builder(state, "delete") };
      }
      throw new Error(`unexpected table in test stub: ${table}`);
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asClient = (db: ReturnType<typeof makeDb>) => db as any;

function makeOrder(overrides: Row = {}): Row {
  return {
    id: ORDER_ID,
    user_id: null,
    total_agorot: 170,
    payment_status: "pending",
    payment_reference: LOW_PROFILE_ID,
    customer_email_sent_at: null,
    admin_email_sent_at: null,
    ...overrides,
  };
}

function validLpResult(overrides: Record<string, unknown> = {}) {
  return {
    ResponseCode: 0,
    Description: "Success",
    ReturnValue: ORDER_ID,
    LowProfileId: LOW_PROFILE_ID,
    TerminalNumber: 172204100, // CardCom returns this as a JSON number
    Operation: "ChargeOnly",
    TranzactionInfo: {
      ResponseCode: 0,
      TranzactionId: 261533601,
      Amount: 1.7,
      ApprovalNumber: "123456",
      CoinId: 1,
      IsRefund: false,
    },
    ...overrides,
  };
}

beforeEach(() => {
  process.env.CARDCOM_TERMINAL_NUMBER = TERMINAL;
  getLpResult.mockReset();
  sendOrderEmails.mockClear();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CARDCOM_TERMINAL_NUMBER;
});

// ─── Happy path ────────────────────────────────────────────────────────────────

describe("an approved ChargeOnly payment", () => {
  it("marks the order paid, sends emails, and never marks it twice", async () => {
    getLpResult.mockResolvedValue(validLpResult());
    const db = makeDb(makeOrder());

    const result = await verifyAndFinalizeCardcomPayment(ORDER_ID, LOW_PROFILE_ID, asClient(db));

    expect(result).toEqual({ outcome: "paid" });
    expect(db.state.payment_status).toBe("paid");
    expect(db.state.order_status).toBe("confirmed");
    expect(db.state.cardcom_approval_number).toBe("123456");
    expect(sendOrderEmails).toHaveBeenCalledTimes(1);
  });

  it("matches an amount at the exact agorot boundary with no floating-point false negative", async () => {
    getLpResult.mockResolvedValue(
      validLpResult({ TranzactionInfo: { ...validLpResult().TranzactionInfo, Amount: 235.5 } })
    );
    const db = makeDb(makeOrder({ total_agorot: 23550 }));

    const result = await verifyAndFinalizeCardcomPayment(ORDER_ID, LOW_PROFILE_ID, asClient(db));

    expect(result).toEqual({ outcome: "paid" });
  });
});

// ─── Declined / transient ──────────────────────────────────────────────────────

describe("a declined payment", () => {
  it("marks the order failed without touching GetLpResult's transaction fields", async () => {
    getLpResult.mockResolvedValue({ ResponseCode: 1, Description: "Card declined" });
    const db = makeDb(makeOrder());

    const result = await verifyAndFinalizeCardcomPayment(ORDER_ID, LOW_PROFILE_ID, asClient(db));

    expect(result.outcome).toBe("failed");
    expect(db.state.payment_status).toBe("failed");
    expect(sendOrderEmails).not.toHaveBeenCalled();
  });
});

describe("a CardCom/network error", () => {
  it("reports transient_error and leaves the order untouched", async () => {
    getLpResult.mockRejectedValue(new Error("fetch failed"));
    const db = makeDb(makeOrder());

    const result = await verifyAndFinalizeCardcomPayment(ORDER_ID, LOW_PROFILE_ID, asClient(db));

    expect(result.outcome).toBe("transient_error");
    expect(db.state.payment_status).toBe("pending");
    expect(sendOrderEmails).not.toHaveBeenCalled();
  });
});

// ─── Identifier / configuration guards ─────────────────────────────────────────

describe("terminal number", () => {
  it("blocks when unconfigured", async () => {
    delete process.env.CARDCOM_TERMINAL_NUMBER;
    getLpResult.mockResolvedValue(validLpResult());
    const db = makeDb(makeOrder());

    const result = await verifyAndFinalizeCardcomPayment(ORDER_ID, LOW_PROFILE_ID, asClient(db));

    expect(result).toEqual({ outcome: "blocked", reason: "terminal_not_configured" });
  });

  it("blocks when missing from the response", async () => {
    getLpResult.mockResolvedValue(validLpResult({ TerminalNumber: undefined }));
    const db = makeDb(makeOrder());

    const result = await verifyAndFinalizeCardcomPayment(ORDER_ID, LOW_PROFILE_ID, asClient(db));

    expect(result).toEqual({ outcome: "blocked", reason: "terminal_missing" });
  });

  it("blocks when it does not match", async () => {
    getLpResult.mockResolvedValue(validLpResult({ TerminalNumber: 999 }));
    const db = makeDb(makeOrder());

    const result = await verifyAndFinalizeCardcomPayment(ORDER_ID, LOW_PROFILE_ID, asClient(db));

    expect(result).toEqual({ outcome: "blocked", reason: "terminal_mismatch" });
  });
});

describe("ReturnValue", () => {
  it("blocks when absent", async () => {
    getLpResult.mockResolvedValue(validLpResult({ ReturnValue: undefined }));
    const db = makeDb(makeOrder());
    expect(await verifyAndFinalizeCardcomPayment(ORDER_ID, LOW_PROFILE_ID, asClient(db))).toEqual({
      outcome: "blocked",
      reason: "return_value_missing",
    });
  });

  it("blocks when it names a different order", async () => {
    getLpResult.mockResolvedValue(validLpResult({ ReturnValue: "some-other-order-id" }));
    const db = makeDb(makeOrder());
    expect(await verifyAndFinalizeCardcomPayment(ORDER_ID, LOW_PROFILE_ID, asClient(db))).toEqual({
      outcome: "blocked",
      reason: "return_value_mismatch",
    });
  });
});

// ─── Newly-added GetLpResult checks ─────────────────────────────────────────────

describe("Operation", () => {
  it("blocks anything other than ChargeOnly", async () => {
    getLpResult.mockResolvedValue(validLpResult({ Operation: "SaveToken" }));
    const db = makeDb(makeOrder());
    expect(await verifyAndFinalizeCardcomPayment(ORDER_ID, LOW_PROFILE_ID, asClient(db))).toEqual({
      outcome: "blocked",
      reason: "operation_mismatch",
    });
  });
});

describe("TranzactionInfo", () => {
  it("blocks when the whole object is missing", async () => {
    getLpResult.mockResolvedValue(validLpResult({ TranzactionInfo: undefined }));
    const db = makeDb(makeOrder());
    expect(await verifyAndFinalizeCardcomPayment(ORDER_ID, LOW_PROFILE_ID, asClient(db))).toEqual({
      outcome: "blocked",
      reason: "tranzaction_info_missing",
    });
  });

  it("blocks when its own ResponseCode is non-zero", async () => {
    getLpResult.mockResolvedValue(
      validLpResult({ TranzactionInfo: { ...validLpResult().TranzactionInfo, ResponseCode: 3 } })
    );
    const db = makeDb(makeOrder());
    expect(await verifyAndFinalizeCardcomPayment(ORDER_ID, LOW_PROFILE_ID, asClient(db))).toEqual({
      outcome: "blocked",
      reason: "tranzaction_response_code_mismatch",
    });
  });

  it("blocks when TranzactionId is missing", async () => {
    getLpResult.mockResolvedValue(
      validLpResult({ TranzactionInfo: { ...validLpResult().TranzactionInfo, TranzactionId: undefined } })
    );
    const db = makeDb(makeOrder());
    expect(await verifyAndFinalizeCardcomPayment(ORDER_ID, LOW_PROFILE_ID, asClient(db))).toEqual({
      outcome: "blocked",
      reason: "tranzaction_id_missing",
    });
  });

  it("blocks a non-ILS CoinId", async () => {
    getLpResult.mockResolvedValue(
      validLpResult({ TranzactionInfo: { ...validLpResult().TranzactionInfo, CoinId: 2 } })
    );
    const db = makeDb(makeOrder());
    expect(await verifyAndFinalizeCardcomPayment(ORDER_ID, LOW_PROFILE_ID, asClient(db))).toEqual({
      outcome: "blocked",
      reason: "coin_id_mismatch",
    });
  });

  it("blocks a refund result", async () => {
    getLpResult.mockResolvedValue(
      validLpResult({ TranzactionInfo: { ...validLpResult().TranzactionInfo, IsRefund: true } })
    );
    const db = makeDb(makeOrder());
    expect(await verifyAndFinalizeCardcomPayment(ORDER_ID, LOW_PROFILE_ID, asClient(db))).toEqual({
      outcome: "blocked",
      reason: "is_refund",
    });
  });
});

// ─── Amount: exact agorot, not a floating-point shekel comparison ─────────────

describe("Amount", () => {
  it("blocks when missing or non-numeric", async () => {
    getLpResult.mockResolvedValue(
      validLpResult({ TranzactionInfo: { ...validLpResult().TranzactionInfo, Amount: undefined } })
    );
    const db = makeDb(makeOrder());
    expect(await verifyAndFinalizeCardcomPayment(ORDER_ID, LOW_PROFILE_ID, asClient(db))).toEqual({
      outcome: "blocked",
      reason: "amount_missing",
    });
  });

  it("blocks a difference of a single agora", async () => {
    // order.total_agorot is 170 (₪1.70); CardCom reports ₪1.71.
    getLpResult.mockResolvedValue(
      validLpResult({ TranzactionInfo: { ...validLpResult().TranzactionInfo, Amount: 1.71 } })
    );
    const db = makeDb(makeOrder());
    const result = await verifyAndFinalizeCardcomPayment(ORDER_ID, LOW_PROFILE_ID, asClient(db));
    expect(result).toEqual({ outcome: "blocked", reason: "amount_mismatch" });
    expect(db.state.payment_status).toBe("pending");
  });
});

// ─── LowProfileId cross-checks ──────────────────────────────────────────────────

describe("LowProfileId", () => {
  it("blocks when it differs from the order's stored reference", async () => {
    getLpResult.mockResolvedValue(validLpResult());
    const db = makeDb(makeOrder({ payment_reference: "a-different-session-id" }));
    expect(await verifyAndFinalizeCardcomPayment(ORDER_ID, LOW_PROFILE_ID, asClient(db))).toEqual({
      outcome: "blocked",
      reason: "low_profile_id_mismatch",
    });
  });

  it("blocks when CardCom's own echoed LowProfileId disagrees", async () => {
    getLpResult.mockResolvedValue(validLpResult({ LowProfileId: "yet-another-session-id" }));
    const db = makeDb(makeOrder());
    expect(await verifyAndFinalizeCardcomPayment(ORDER_ID, LOW_PROFILE_ID, asClient(db))).toEqual({
      outcome: "blocked",
      reason: "low_profile_id_response_mismatch",
    });
  });
});

// ─── Idempotency and concurrency ────────────────────────────────────────────────

describe("an order not found", () => {
  it("is blocked, not treated as any kind of success", async () => {
    const db = makeDb(makeOrder({ id: "some-other-id" }));
    const result = await verifyAndFinalizeCardcomPayment(ORDER_ID, LOW_PROFILE_ID, asClient(db));
    expect(result).toEqual({ outcome: "blocked", reason: "order_not_found" });
    expect(getLpResult).not.toHaveBeenCalled();
  });
});

describe("an already-paid order", () => {
  it("short-circuits before ever calling GetLpResult", async () => {
    const db = makeDb(
      makeOrder({
        payment_status: "paid",
        customer_email_sent_at: "2026-01-01T00:00:00Z",
        admin_email_sent_at: "2026-01-01T00:00:00Z",
      })
    );

    const result = await verifyAndFinalizeCardcomPayment(ORDER_ID, LOW_PROFILE_ID, asClient(db));

    expect(result).toEqual({ outcome: "already_paid" });
    expect(getLpResult).not.toHaveBeenCalled();
    expect(sendOrderEmails).not.toHaveBeenCalled();
  });

  it("still sends emails if a crash left them unsent", async () => {
    const db = makeDb(makeOrder({ payment_status: "paid" }));

    const result = await verifyAndFinalizeCardcomPayment(ORDER_ID, LOW_PROFILE_ID, asClient(db));

    expect(result).toEqual({ outcome: "already_paid" });
    expect(sendOrderEmails).toHaveBeenCalledTimes(1);
  });
});

describe("a concurrent finalization that wins the CAS first", () => {
  it("reports already_paid and does not re-send emails", async () => {
    // Verification passes, but by the time the CAS runs the row is no longer
    // in pending/failed — exactly what a second caller having just won the
    // race looks like from here.
    getLpResult.mockResolvedValue(validLpResult());
    const db = makeDb(makeOrder({ payment_status: "cancelled" }));

    const result = await verifyAndFinalizeCardcomPayment(ORDER_ID, LOW_PROFILE_ID, asClient(db));

    expect(result).toEqual({ outcome: "already_paid" });
    expect(sendOrderEmails).not.toHaveBeenCalled();
  });
});

describe("a database failure on the CAS write", () => {
  it("is reported as transient_error, never as already_paid", async () => {
    getLpResult.mockResolvedValue(validLpResult());

    const state = makeOrder();
    const db = {
      from(table: string) {
        if (table === "orders") {
          return {
            select: () => ({
              eq: () => ({
                async single() {
                  return { data: { ...state }, error: null };
                },
              }),
            }),
            update: () => ({
              eq: () => ({
                in: () => ({
                  select: async () => ({
                    data: null,
                    error: { message: "connection reset", code: "08006" },
                  }),
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table: ${table}`);
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const result = await verifyAndFinalizeCardcomPayment(ORDER_ID, LOW_PROFILE_ID, db);

    expect(result).toEqual({ outcome: "transient_error", reason: "cas_update_failed" });
    expect(sendOrderEmails).not.toHaveBeenCalled();
  });
});
