"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Container } from "@/components/ui/Container";

export default function ShopError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex-1 py-20" style={{ backgroundColor: "var(--color-surface)" }}>
      <Container>
        <div className="max-w-md mx-auto text-center">
          <div className="h-16 w-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="h-8 w-8 text-red-400" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">אירעה שגיאה</h1>
          <p className="text-stone-500 text-sm mb-6 leading-relaxed">
            לא הצלחנו לטעון את הדף. ייתכן שיש בעיה זמנית בשרת.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={reset}
              className="h-11 px-6 rounded-full bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors"
            >
              נסו שוב
            </button>
            <Link
              href="/"
              className="h-11 px-6 rounded-full border border-stone-200 text-stone-700 font-semibold text-sm hover:bg-stone-50 transition-colors inline-flex items-center justify-center"
            >
              לדף הבית
            </Link>
          </div>
        </div>
      </Container>
    </main>
  );
}
