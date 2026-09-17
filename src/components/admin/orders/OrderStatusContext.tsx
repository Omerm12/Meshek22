"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { OrderPresentationContext } from "@/lib/admin/order-presentation";

/**
 * Shares one order's live status/payment state between two client components
 * that sit in different parts of the server-rendered page — the header badges
 * and the workflow action buttons — without a full page refresh in between.
 *
 * Why this exists: after a status transition, the obvious fix is
 * `router.refresh()`. That re-runs the protected layout (a fresh
 * `requireAdmin()` — a real auth round trip, not reused from the mutation's
 * own request) and re-reads the order, on top of the round trips the mutation
 * itself already paid for. The Server Action already knows the new status for
 * free (it computed it to decide the write), so the client can apply it
 * directly instead of paying for a second full render.
 */
interface OrderStatusContextValue {
  orderId: string;
  context: OrderPresentationContext;
  applyTransition: (next: { orderStatus: string; paymentStatus: string }) => void;
}

const OrderStatusCtx = createContext<OrderStatusContextValue | null>(null);

export function OrderStatusProvider({
  orderId,
  initialContext,
  children,
}: {
  orderId: string;
  initialContext: OrderPresentationContext;
  children: React.ReactNode;
}) {
  const [context, setContext] = useState(initialContext);

  const applyTransition = useCallback(
    (next: { orderStatus: string; paymentStatus: string }) => {
      setContext((prev) => ({ ...prev, ...next }));
    },
    []
  );

  const value = useMemo(
    () => ({ orderId, context, applyTransition }),
    [orderId, context, applyTransition]
  );

  return <OrderStatusCtx.Provider value={value}>{children}</OrderStatusCtx.Provider>;
}

export function useOrderStatus(): OrderStatusContextValue {
  const ctx = useContext(OrderStatusCtx);
  if (!ctx) throw new Error("useOrderStatus must be used within OrderStatusProvider");
  return ctx;
}
