import type { Metadata } from "next";
import Link from "next/link";
import { XCircle, RefreshCw, Phone, ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "שגיאת תשלום | משק 22",
};

export default async function CheckoutFailurePage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderNumber } = await searchParams;

  return (
    <main
      className="flex-1 py-12 lg:py-20"
      style={{ backgroundColor: "var(--color-surface)" }}
    >
      <Container>
        <div className="max-w-md mx-auto text-center">
          {/* Status icon */}
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-red-100 mb-5">
            <XCircle className="h-10 w-10 text-red-500" aria-hidden="true" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-3">התשלום לא הושלם</h1>
          <p className="text-stone-500 leading-relaxed mb-2">
            אירעה שגיאה בעיבוד התשלום. ההזמנה שלכם שמורה במערכת — לא חויבתם.
          </p>

          {orderNumber && (
            <p className="text-sm text-stone-400 mb-6">
              מספר הזמנה:{" "}
              <span className="font-mono font-bold text-gray-900">{orderNumber}</span>
            </p>
          )}

          {/* Common reasons */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8 text-start">
            <h2 className="font-semibold text-amber-800 text-sm mb-2">
              סיבות נפוצות לכשל בתשלום:
            </h2>
            <ul className="space-y-1.5 text-sm text-amber-700 list-disc list-inside">
              <li>פרטי כרטיס האשראי שגויים</li>
              <li>כרטיס מוגבל לרכישות אינטרנט</li>
              <li>יתרה לא מספיקה</li>
              <li>בעיה זמנית אצל ספק התשלום</li>
            </ul>
          </div>

          {/* Support */}
          <div className="text-sm text-stone-500 mb-8">
            <p className="mb-2">הזמנתכם שמורה. צרו קשר ונסדר זאת ביחד:</p>
            <a
              href="tel:*3722"
              className="inline-flex items-center gap-1.5 text-brand-700 hover:text-brand-800 font-semibold transition-colors"
            >
              <Phone className="h-4 w-4" />
              *3722
            </a>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/checkout"
              className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-full bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              נסו שוב
            </Link>
            <Link
              href="/cart"
              className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-full border border-stone-200 text-stone-700 font-semibold text-sm hover:border-brand-400 hover:text-brand-700 transition-colors"
            >
              חזרה לסל
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </Container>
    </main>
  );
}
