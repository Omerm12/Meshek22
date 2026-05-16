"use client";

import { useEffect } from "react";
import Image from "next/image";
import { ShieldCheck } from "lucide-react";

interface PaymentRedirectOverlayProps {
  paymentUrl: string;
}

export function PaymentRedirectOverlay({ paymentUrl }: PaymentRedirectOverlayProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.href = paymentUrl;
    }, 1200);
    return () => clearTimeout(timer);
  }, [paymentUrl]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: "var(--color-surface)" }}
    >
      <div
        className="bg-white rounded-2xl border border-stone-100 p-8 sm:p-10 text-center max-w-sm w-full"
        style={{ boxShadow: "0 4px 24px rgba(0,0,0,.08)" }}
      >
        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <Image
            src="/images/heroes/logo.png"
            alt="משק 22"
            width={60}
            height={60}
            className="object-contain"
            priority
          />
        </div>

        {/* Animated bouncing dots */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <span
            className="h-2.5 w-2.5 rounded-full bg-brand-600"
            style={{ animation: "dot-bounce 1.2s ease-in-out infinite", animationDelay: "0s" }}
          />
          <span
            className="h-2.5 w-2.5 rounded-full bg-brand-600"
            style={{ animation: "dot-bounce 1.2s ease-in-out infinite", animationDelay: "0.2s" }}
          />
          <span
            className="h-2.5 w-2.5 rounded-full bg-brand-600"
            style={{ animation: "dot-bounce 1.2s ease-in-out infinite", animationDelay: "0.4s" }}
          />
          <style>{`
            @keyframes dot-bounce {
              0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
              40%            { transform: scale(1.3); opacity: 1; }
            }
          `}</style>
        </div>

        {/* Title */}
        <h1 className="text-lg font-bold text-gray-900 mb-2">
          רגע, מעבירים אותך לתשלום מאובטח...
        </h1>

        {/* Subtitle */}
        <p className="text-sm text-stone-500 leading-relaxed">
          ההזמנה נשמרת במערכת. נא לא לרענן את הדף.
        </p>

        {/* Trust badge */}
        <div className="flex items-center justify-center gap-1.5 mt-6 text-xs text-stone-400">
          <ShieldCheck className="h-3.5 w-3.5 text-brand-500 shrink-0" />
          מאובטח על ידי CardCom
        </div>
      </div>
    </div>
  );
}
