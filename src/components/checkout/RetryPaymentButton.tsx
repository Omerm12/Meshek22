"use client";

import { useState, useTransition } from "react";
import { RefreshCcw, Loader2 } from "lucide-react";
import { retryPayment } from "@/app/(shop)/checkout/actions";

interface Props {
  /** Order UUID from /checkout/payment-error?orderId=... query param.
   *  If undefined (user arrived via browser back without the error URL), fall
   *  back to a simple link to /checkout. */
  orderId?: string;
}

/**
 * "נסה שוב" button on the payment-error page.
 *
 * When orderId is present:
 * - Calls retryPayment(orderId) server action which creates a new Cardcom
 *   LowProfile session for the existing pending/failed order.
 * - On success, redirects via window.location.href to the new Cardcom URL
 *   (external URL, needs full-page navigation).
 * - Shows a loading spinner while the server action is in flight.
 * - On auth error, navigates to /checkout so the user can sign in again.
 *
 * When orderId is absent (browser-back scenario):
 * - Renders as a plain anchor link to /checkout.
 */
export function RetryPaymentButton({ orderId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // No orderId means user arrived here via browser back (not via FailedRedirectUrl).
  // Just send them back to checkout to restart the flow.
  if (!orderId) {
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
      const result = await retryPayment(orderId);

      if ("error" in result) {
        // Auth error → send to checkout/login gate so user can re-authenticate.
        if (result.error.includes("להתחבר")) {
          window.location.href = "/checkout";
          return;
        }
        setError(result.error);
        return;
      }

      // Redirect to new Cardcom payment URL (external, must use window.location).
      window.location.href = result.paymentUrl;
    });
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleRetry}
        disabled={isPending}
        className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
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
