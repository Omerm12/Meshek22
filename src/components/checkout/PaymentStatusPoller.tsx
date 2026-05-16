"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { getOrderPaymentStatus } from "@/app/(shop)/checkout/actions";

const POLL_INTERVAL_MS = 2000;
const TIMEOUT_MS       = 30_000;

export function PaymentStatusPoller({ orderNumber }: { orderNumber: string }) {
  const [dotCount, setDotCount]   = useState(1);
  const [timedOut, setTimedOut]   = useState(false);

  // Animate "בודקים." → "בודקים.." → "בודקים..."
  useEffect(() => {
    const id = setInterval(() => setDotCount((n) => (n % 3) + 1), 500);
    return () => clearInterval(id);
  }, []);

  const check = useCallback(async () => {
    try {
      const status = await getOrderPaymentStatus(orderNumber);
      if (status === "paid") {
        try { sessionStorage.removeItem("meshek22_checkout_draft"); } catch {}
        window.location.reload();
      }
    } catch {
      // Ignore transient network errors — next tick will retry
    }
  }, [orderNumber]);

  useEffect(() => {
    check(); // Immediate check on mount

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
      <div className="py-6 text-center">
        <p className="text-gray-900 font-semibold mb-2">ההזמנה שלך נשמרה במערכת</p>
        <p className="text-stone-500 text-sm leading-relaxed">
          אם התשלום עבר, תקבלו אישור במייל תוך מספר דקות.
          <br />
          אם לא, ניתן לנסות שוב מ
          <a href="/checkout" className="text-brand-600 hover:underline">
            דף התשלום
          </a>
          .
        </p>
      </div>
    );
  }

  const dots = ".".repeat(dotCount);

  return (
    <div className="py-6 text-center">
      <Loader2 className="h-10 w-10 text-brand-600 animate-spin mx-auto mb-4" />
      <p className="text-base font-semibold text-gray-900">
        בודקים את סטטוס התשלום{dots}
      </p>
      <p className="text-stone-500 text-sm mt-2">נא לא לסגור את הדף</p>
    </div>
  );
}
