"use client";

import { useState, useTransition } from "react";
import { RefreshCcw, Loader2 } from "lucide-react";
import { retryPayment } from "@/app/(shop)/checkout/actions";

interface Props {
  /** Order UUID from /checkout/payment-error?orderId=… */
  orderId?: string;
  /** Guest access token from the same URL — required to authorise the retry. */
  token?: string;
}

/**
 * "נסה שוב" on the payment-error page.
 *
 * With an orderId AND a token it asks the server for a fresh CardCom session for
 * the existing pending/failed order. Authorisation is the token: there is no
 * login, and the server refuses the retry if the token does not match the stored
 * hash — returning the same generic message either way.
 *
 * Without them (the customer arrived here via browser back) it degrades to a
 * plain link back to checkout, where the preserved cart is still waiting.
 */
export function RetryPaymentButton({ orderId, token }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!orderId || !token) {
    return (
      <a
        href="/checkout"
        className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors"
      >
        <RefreshCcw className="h-4 w-4" aria-hidden="true" />
        נסה שוב
      </a>
    );
  }

  const handleRetry = () => {
    setError(null);
    startTransition(async () => {
      const result = await retryPayment(orderId, token);

      if ("error" in result) {
        setError(result.error);
        return;
      }

      // External CardCom URL — needs a full-page navigation.
      window.location.href = result.paymentUrl;
    });
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleRetry}
        disabled={isPending}
        className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />
        )}
        {isPending ? "מאחזר פרטי תשלום..." : "נסה שוב"}
      </button>

      {error && (
        <p className="text-red-600 text-sm text-center" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
