"use client";

import { ShoppingBag, LogIn } from "lucide-react";
import { useAuthModal } from "@/store/auth-modal";
import { Container } from "@/components/ui/Container";

/**
 * Shown inside checkout/page.tsx when no authenticated session exists.
 * Opens the auth modal instead of hard-redirecting to /login.
 * AuthModal.handleSuccess always calls router.refresh() after a successful auth,
 * so the server component re-runs and renders the real CheckoutForm automatically.
 */
export function CheckoutLoginGate() {
  const { openModal } = useAuthModal();

  return (
    <main
      className="flex-1 py-24"
      style={{ backgroundColor: "var(--color-surface)" }}
    >
      <Container>
        <div className="max-w-lg mx-auto text-center">
          <div className="h-24 w-24 bg-brand-50 rounded-3xl flex items-center justify-center mx-auto mb-7">
            <ShoppingBag className="h-12 w-12 text-brand-500" aria-hidden="true" />
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-3">כמעט שם!</h1>
          <p className="text-stone-500 text-lg leading-relaxed mb-8">
            כדי להמשיך לתשלום יש להתחבר לחשבון.
            <br />
            ההתחברות לוקחת שנייה בלבד.
          </p>

          <button
            onClick={() => openModal()}
            className="inline-flex items-center justify-center gap-2 h-14 px-10 rounded-full bg-brand-600 text-white font-bold text-base hover:bg-brand-700 active:bg-brand-800 transition-colors shadow-md cursor-pointer"
          >
            <LogIn className="h-5 w-5" aria-hidden="true" />
            התחברות / הרשמה
          </button>
        </div>
      </Container>
    </main>
  );
}
