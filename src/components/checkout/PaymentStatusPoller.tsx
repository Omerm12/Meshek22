"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { getGuestOrderStatus } from "@/app/(shop)/checkout/actions";

const POLL_INTERVAL_MS = 2_000;
const TIMEOUT_MS       = 45_000; // 45 s — gives the webhook time to arrive and GetLpResult to respond

/**
 * Polls the server until the CardCom webhook marks the order paid.
 *
 * Both the order number and the guest access token are sent on every poll; the
 * server matches on the token hash, so polling cannot be used to discover the
 * status of somebody else's order.
 */
export function PaymentStatusPoller({
  orderNumber,
  token,
}: {
  orderNumber: string;
  token: string;
}) {
  const router = useRouter();
  const [dotCount, setDotCount] = useState(1);
  const [timedOut, setTimedOut] = useState(false);

  // Animate "בודקים." → "בודקים.." → "בודקים..."
  useEffect(() => {
    const id = setInterval(() => setDotCount((n) => (n % 3) + 1), 500);
    return () => clearInterval(id);
  }, []);

  const check = useCallback(async () => {
    try {
      const status = await getGuestOrderStatus(orderNumber, token);
      if (status?.paymentStatus === "paid") {
        // Payment confirmed — reload so the server component renders the final
        // success state (which is also what clears the cart).
        window.location.reload();
      } else if (status?.paymentStatus === "failed") {
        // CardCom itself reported a decline (not a delay, not a timeout) — send
        // the customer to the existing failure experience with a retry option.
        router.replace(
          `/checkout/payment-error?orderId=${encodeURIComponent(status.orderId)}&t=${encodeURIComponent(token)}`
        );
      }
    } catch {
      // Ignore transient network errors — the next tick retries.
    }
  }, [orderNumber, token, router]);

  useEffect(() => {
    check(); // Immediate first check in case the webhook already fired.

    const pollId    = setInterval(check, POLL_INTERVAL_MS);
    const timeoutId = setTimeout(() => {
      clearInterval(pollId);
      setTimedOut(true);
    }, TIMEOUT_MS);

    return () => {
      clearInterval(pollId);
      clearTimeout(timeoutId);
    };
  }, [check]);

  if (timedOut) {
    return (
      <div className="py-6 text-center space-y-4">
        <p className="text-gray-900 font-semibold">
          התשלום התקבל ונמצא בבדיקה. נעדכן את ההזמנה מיד.
        </p>
        <p className="text-stone-500 text-sm leading-relaxed">
          תקבלו אישור במייל ברגע שהתשלום אומת.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center h-10 px-6 rounded-full bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors"
        >
          חזרה לדף הבית
        </Link>
      </div>
    );
  }

  const dots = ".".repeat(dotCount);

  return (
    <div className="py-6 text-center" role="status" aria-live="polite">
      <Loader2 className="h-10 w-10 text-brand-600 animate-spin mx-auto mb-4" aria-hidden="true" />
      <p className="text-base font-semibold text-gray-900">
        בודקים את סטטוס התשלום{dots}
      </p>
      <p className="text-stone-500 text-sm mt-2">נא לא לסגור את הדף</p>
    </div>
  );
}
