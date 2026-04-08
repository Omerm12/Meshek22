"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import { useAuthModal } from "@/store/auth-modal";
import { createClient } from "@/lib/supabase/client";
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

  const handleSuccess = async () => {
    closeModal();

    const supabase = createClient();

    // Step 1: getUser() forces the client to load + validate the session from
    // cookies before we attempt any table query. Skipping this caused the
    // previous implementation to query with an uninitialised session → RLS
    // filtered out all rows → profile was null → admin redirect never fired.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (process.env.NODE_ENV === "development") {
      console.log("[AuthModal] handleSuccess — user:", user?.id ?? "(none)");
    }

    if (!user) {
      router.refresh();
      onSuccess?.();
      return;
    }

    // Step 2: Fetch profile with an explicit .eq filter — never rely solely on
    // RLS implicit filtering inside modal handlers where session timing is tight.
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (process.env.NODE_ENV === "development") {
      console.log(
        "[AuthModal] handleSuccess — role:",
        profile?.role ?? "(none)",
        profileError ? `error: ${profileError.message}` : ""
      );
    }

    // Step 3: Branch on role
    if (profile?.role === "admin") {
      if (process.env.NODE_ENV === "development") {
        console.log("[AuthModal] handleSuccess — admin → /admin");
      }
      router.push("/admin");
      return;
    }

    if (process.env.NODE_ENV === "development") {
      console.log("[AuthModal] handleSuccess — non-admin, refreshing");
    }
    router.refresh();
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
          "w-full max-w-md bg-white rounded-2xl shadow-2xl",
          "flex flex-col overflow-hidden"
        )}
      >
        {/* ── Header: logo + close button ── */}
        <div className="flex items-center justify-between px-7 pt-6 pb-0">
          <Image
            src="/images/heroes/logo.png"
            alt="משק 22"
            width={90}
            height={30}
            className="h-8 w-auto object-contain"
          />
          <button
            onClick={closeModal}
            aria-label="סגור"
            className="h-8 w-8 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Login / Register tabs ── */}
        <div className="mx-7 mt-5 flex gap-0 border border-stone-200 rounded-xl p-1 bg-stone-50">
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
        <div className="px-7 pt-5 pb-7 overflow-y-auto max-h-[70vh]">
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
