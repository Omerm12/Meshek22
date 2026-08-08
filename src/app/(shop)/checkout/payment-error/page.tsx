import type { Metadata } from "next";
import Link from "next/link";
import { XCircle, ShoppingCart } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { RetryPaymentButton } from "@/components/checkout/RetryPaymentButton";

export const metadata: Metadata = {
  title: "התשלום לא הושלם | משק 22",
};

export default async function PaymentErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; t?: string }>;
}) {
  // orderId + t are set by Cardcom's FailedRedirectUrl:
  //   /checkout/payment-error?orderId=<uuid>&t=<access token>
  // Both are absent when the customer arrives via browser back (history
  // navigation), in which case the retry button degrades to a link to /checkout.
  // The cart is intentionally still intact — a failed payment never clears it.
  const { orderId, t: token } = await searchParams;

  return (
    <main
      className="flex-1 py-12 lg:py-20"
      style={{ backgroundColor: "var(--color-surface)" }}
    >
      <Container>
        <div className="max-w-md mx-auto text-center">
          {/* Icon */}
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-red-100 mb-6">
            <XCircle className="h-10 w-10 text-red-500" aria-hidden="true" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            התשלום לא הושלם
          </h1>
          <p className="text-stone-500 leading-relaxed mb-8">
            התשלום לא הושלם. ניתן לנסות שוב או לחזור ולערוך את ההזמנה.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {/*
              RetryPaymentButton:
              - With orderId + token: calls the retryPayment Server Action, which
                verifies the token against the stored hash and mints a new Cardcom
                session for the same order.
              - Without them (browser back): a plain link to /checkout.
              The cart is never cleared on this path.
            */}
            <RetryPaymentButton orderId={orderId} token={token} />

            <Link
              href="/checkout"
              className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full border border-stone-300 text-gray-700 font-semibold text-sm hover:bg-stone-50 transition-colors"
            >
              <ShoppingCart className="h-4 w-4" aria-hidden="true" />
              חזרה לעריכת ההזמנה
            </Link>
          </div>
        </div>
      </Container>
    </main>
  );
}
