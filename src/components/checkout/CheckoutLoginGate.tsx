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

  const handleOpen = () => {
    openModal();
  };

  return (
    <main
      className="flex-1 py-20"
      style={{ backgroundColor: "var(--color-surface)" }}
    >
      <Container>
        <div className="max-w-md mx-auto text-center">
          <div className="h-16 w-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <ShoppingBag className="h-8 w-8 text-brand-500" aria-hidden="true" />
          </div>

          <h1 className="text-xl font-bold text-gray-900 mb-2">כמעט שם!</h1>
          <p className="text-stone-500 text-sm leading-relaxed mb-6">
            כדי להמשיך לתשלום יש להתחבר לחשבון.
            <br />
            ההתחברות לוקחת שנייה בלבד.
          </p>

          <button
            onClick={handleOpen}
            className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-full bg-brand-600 text-white font-bold text-sm hover:bg-brand-700 active:bg-brand-800 transition-colors shadow-sm cursor-pointer"
          >
            <LogIn className="h-4 w-4" aria-hidden="true" />
            התחברות / הרשמה
          </button>
        </div>
      </Container>
    </main>
  );
}
