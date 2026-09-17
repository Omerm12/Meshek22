"use client";

import { describeOrderStatus, describePaymentState } from "@/lib/admin/order-presentation";
import { useOrderStatus } from "@/components/admin/orders/OrderStatusContext";

/**
 * The two header badges that change on a status transition (payment state and
 * order status). Reads from OrderStatusProvider so a transition updates them
 * immediately, without asking the server to re-render the page.
 */
export function OrderStatusBadges() {
  const { context } = useOrderStatus();
  const status = describeOrderStatus(context);
  const payment = describePaymentState(context);

  return (
    <>
      <span className={`inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold border whitespace-nowrap ${payment.cls}`}>
        {payment.label}
      </span>
      <span className={`inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold border whitespace-nowrap ${status.cls}`}>
        {status.label}
      </span>
    </>
  );
}
