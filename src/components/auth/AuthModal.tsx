"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, Leaf } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useAuthModal } from "@/store/auth-modal";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";

type Tab = "login" | "register";

export function AuthModal() {
  const { isOpen, closeModal, onSuccess } = useAuthModal();
  const [tab, setTab] = useState<Tab>("login");
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Reset to login tab each time the modal opens
  useEffect(() => {
    if (isOpen) setTab("login");
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, closeModal]);

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleSuccess = () => {
    closeModal();
    // Always refresh so server components on the current page (e.g. CheckoutPage)
    // re-run with the now-authenticated session. Client components (Header) update
    // automatically via onAuthStateChange in UserProvider without needing this.
    router.refresh();
    // Run any caller-specific callback after the refresh is queued.
    onSuccess?.();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay — click to close */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={closeModal}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={tab === "login" ? "כניסה לחשבון" : "הרשמה"}
        className={cn(
          "fixed z-50 inset-x-4 top-1/2 -translate-y-1/2 mx-auto",
          "w-full max-w-sm bg-white rounded-2xl shadow-2xl",
          "flex flex-col overflow-hidden"
        )}
      >
        {/* ── Header: logo + close button ── */}
        <div className="flex items-center justify-between px-6 pt-5 pb-0">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-brand-600 flex items-center justify-center shrink-0">
              <Leaf className="h-4 w-4 text-white" aria-hidden="true" />
            </div>
            <span className="font-bold text-gray-900">משק 22</span>
          </div>
          <button
            onClick={closeModal}
            aria-label="סגור"
            className="h-8 w-8 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Login / Register tabs ── */}
        <div className="mx-6 mt-4 flex gap-0 border border-stone-200 rounded-xl p-1 bg-stone-50">
          <button
            onClick={() => setTab("login")}
            className={cn(
              "flex-1 h-8 rounded-lg text-sm font-medium transition-all",
              tab === "login"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-stone-500 hover:text-gray-700"
            )}
          >
            כניסה
          </button>
          <button
            onClick={() => setTab("register")}
            className={cn(
              "flex-1 h-8 rounded-lg text-sm font-medium transition-all",
              tab === "register"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-stone-500 hover:text-gray-700"
            )}
          >
            הרשמה
          </button>
        </div>

        {/* ── Form area — scrollable on small screens ── */}
        <div className="px-6 pt-4 pb-6 overflow-y-auto max-h-[70vh]">
          {tab === "login" ? (
            <LoginForm
              onSuccess={handleSuccess}
              onSwitchToRegister={() => setTab("register")}
            />
          ) : (
            <RegisterForm
              onSuccess={handleSuccess}
              onSwitchToLogin={() => setTab("login")}
            />
          )}
        </div>
      </div>
    </>
  );
}
