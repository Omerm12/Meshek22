import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Behavioural coverage for applyOrderTransition(), focused on the perceived-
 * performance fix: the action now returns the resulting order/payment status
 * on the common (CAS-transition) success path, so the client can update its
 * badges and buttons from the action's own response instead of paying for a
 * second requireAdmin() + a second order read via router.refresh(). This
 * suite proves the returned fields actually match what was written, and that
 * revalidation stays scoped to the admin order surfaces (see
 * lib/admin/revalidate.ts's revalidateStorefront() for the storefront-cache
 * boundary this must never cross).
 *
 * Supabase and requireAdmin are stubbed; resolveTransition and the rest of
 * the workflow logic run for real.
 */

const { requireAdminMock, revalidatePathMock, dbRef } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(async () => ({
    id: "admin-1",
    email: "admin@meshek22.co.il",
    full_name: "מנהל",
    role: "admin",
  })),
  revalidatePathMock: vi.fn(),
  dbRef: { current: null as unknown },
}));

vi.mock("@/lib/admin/auth", () => ({ requireAdmin: requireAdminMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/lib/payment/cardcomFinalize", () => ({ recoverPaymentByOrderId: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => dbRef.current }));

import { applyOrderTransition } from "@/app/meshek22-control/(protected)/orders/actions";

function orderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    order_number: "M22-0001",
    order_status: "confirmed",
    payment_status: "pending",
    payment_method: "cash",
    fulfillment_method: "delivery",
    total_agorot: 5000,
    created_at: "2026-01-01T00:00:00Z",
    customer_snapshot: { name: "לקוח", phone: "0500000000" },
    ...overrides,
  };
}

/** Minimal `orders` table stub covering the one read + one CAS update the
 * action issues, regardless of which column list is requested. */
function makeDb(row: ReturnType<typeof orderRow>, { updateMatches = true } = {}) {
  const updateCalls: Record<string, unknown>[] = [];
  return {
    updateCalls,
    from(table: string) {
      if (table !== "orders") throw new Error(`unexpected table in test stub: ${table}`);
      return {
        select: () => ({
          eq: () => ({
            limit: async () => ({ data: [row], error: null }),
          }),
        }),
        update: (patch: Record<string, unknown>) => {
          updateCalls.push(patch);
          return {
            eq: () => ({
              eq: () => ({
                select: async () =>
                  updateMatches ? { data: [{ id: row.id }], error: null } : { data: [], error: null },
              }),
            }),
          };
        },
      };
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asDb = (db: ReturnType<typeof makeDb>) => db as any;

beforeEach(() => {
  revalidatePathMock.mockClear();
  requireAdminMock.mockClear();
});

describe("applyOrderTransition — result shape", () => {
  it("returns the resulting order status on a plain forward transition", async () => {
    const db = makeDb(orderRow({ order_status: "confirmed" }));
    dbRef.current = asDb(db);

    const result = await applyOrderTransition("order-1", "start_preparing");

    expect(result).toEqual({
      success: true,
      orderStatus: "preparing",
      paymentStatus: "pending", // unchanged — start_preparing never touches payment
    });
    expect(db.updateCalls).toEqual([
      expect.objectContaining({ order_status: "preparing" }),
    ]);
  });

  it("returns the settled payment status when completing an uncollected cash order", async () => {
    const db = makeDb(
      orderRow({ order_status: "out_for_delivery", payment_method: "cash", payment_status: "pending" })
    );
    dbRef.current = asDb(db);

    const result = await applyOrderTransition("order-1", "mark_delivered", { cashReceived: true });

    expect(result).toEqual({ success: true, orderStatus: "delivered", paymentStatus: "paid" });
    expect(db.updateCalls[0]).toEqual(
      expect.objectContaining({ order_status: "delivered", payment_status: "paid" })
    );
  });

  it("reports failure without a status when the compare-and-set matches no row (stale order)", async () => {
    const db = makeDb(orderRow({ order_status: "confirmed" }), { updateMatches: false });
    dbRef.current = asDb(db);

    const result = await applyOrderTransition("order-1", "start_preparing");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("השתנה בינתיים");
    }
  });

  it("re-checks authorization independently of any page render", async () => {
    const db = makeDb(orderRow());
    dbRef.current = asDb(db);

    await applyOrderTransition("order-1", "start_preparing");

    expect(requireAdminMock).toHaveBeenCalledTimes(1);
  });
});

describe("applyOrderTransition — revalidation scope", () => {
  it("revalidates only the admin dashboard, order list and this order — nothing storefront-facing", async () => {
    const db = makeDb(orderRow({ order_status: "confirmed" }));
    dbRef.current = asDb(db);

    await applyOrderTransition("order-1", "start_preparing");

    const paths = revalidatePathMock.mock.calls.map((call) => call[0]);
    expect(paths).toEqual(
      expect.arrayContaining(["/meshek22-control", "/meshek22-control/orders", "/meshek22-control/orders/order-1"])
    );
    expect(paths.some((p) => typeof p === "string" && !p.startsWith("/meshek22-control"))).toBe(false);
  });
});
