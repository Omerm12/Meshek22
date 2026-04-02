"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { emailPasswordLoginSchema } from "@/lib/validations/auth";
import type { EmailPasswordLoginFormData } from "@/lib/validations/auth";

interface LoginFormProps {
  /**
   * Called after a successful login when the form is rendered inside a modal.
   * When provided, the form does NOT navigate — the caller handles what happens next.
   * When omitted (standalone page), the form redirects using the ?next= param.
   */
  onSuccess?: () => void;
  /**
   * When rendered inside a modal, called to switch to the register tab.
   * When omitted, the bottom link navigates to /register instead.
   */
  onSwitchToRegister?: () => void;
}

/**
 * Temporary email + password login.
 * TODO: Replace with phone OTP flow when SMS provider is connected.
 */
export function LoginForm({ onSuccess, onSwitchToRegister }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [serverError, setServerError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<EmailPasswordLoginFormData>({
    resolver: zodResolver(emailPasswordLoginSchema),
  });

  const onSubmit = async (data: EmailPasswordLoginFormData) => {
    setServerError("");
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      if (
        error.message.includes("Invalid login credentials") ||
        error.message.includes("invalid_credentials")
      ) {
        setServerError("אימייל או סיסמה שגויים. נסו שוב.");
      } else if (error.message.includes("Email not confirmed")) {
        setServerError(
          "יש לאמת את כתובת האימייל לפני הכניסה. בדקו את תיבת הדואר."
        );
      } else {
        setServerError("שגיאה בכניסה. נסו שוב.");
      }
      return;
    }

    if (onSuccess) {
      // Modal context — let the caller decide what to do next
      onSuccess();
    } else {
      // Standalone page — navigate to ?next= destination
      const next = searchParams.get("next") ?? "/account";
      router.replace(next);
      router.refresh();
    }
  };

  return (
    <div>
      {/* Title is shown only on the standalone page; modal has its own header */}
      {!onSuccess && (
        <>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">כניסה לחשבון</h1>
          <p className="text-sm text-stone-500 mb-7">הזינו את פרטי הכניסה שלכם</p>
        </>
      )}

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="space-y-4"
      >
        {/* Email */}
        <div>
          <label
            htmlFor="login-email"
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            כתובת אימייל
          </label>
          <div className="relative">
            <Mail
              className="absolute top-1/2 -translate-y-1/2 start-3.5 h-4 w-4 text-stone-400 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              dir="ltr"
              placeholder="you@example.com"
              {...form.register("email")}
              className={[
                "w-full h-11 bg-white border rounded-xl ps-10 pe-4 text-sm text-gray-900 placeholder:text-stone-400",
                "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow",
                form.formState.errors.email
                  ? "border-red-400"
                  : "border-stone-200",
              ].join(" ")}
            />
          </div>
          {form.formState.errors.email && (
            <p className="mt-1.5 text-xs text-red-500">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>

        {/* Password */}
        <div>
          <label
            htmlFor="login-password"
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            סיסמה
          </label>
          <div className="relative">
            <Lock
              className="absolute top-1/2 -translate-y-1/2 start-3.5 h-4 w-4 text-stone-400 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              dir="ltr"
              placeholder="••••••••"
              {...form.register("password")}
              className={[
                "w-full h-11 bg-white border rounded-xl ps-10 pe-10 text-sm text-gray-900 placeholder:text-stone-400",
                "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow",
                form.formState.errors.password
                  ? "border-red-400"
                  : "border-stone-200",
              ].join(" ")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute top-1/2 -translate-y-1/2 end-3.5 text-stone-400 hover:text-stone-600 transition-colors"
              aria-label={showPassword ? "הסתר סיסמה" : "הצג סיסמה"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {form.formState.errors.password && (
            <p className="mt-1.5 text-xs text-red-500">
              {form.formState.errors.password.message}
            </p>
          )}
        </div>

        {serverError && (
          <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            {serverError}
          </p>
        )}

        <button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="w-full h-11 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
        >
          {form.formState.isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            "כניסה"
          )}
        </button>
      </form>

      {/* Switch to register */}
      <p className="text-center text-sm text-stone-500 mt-5">
        לקוחות חדשים?{" "}
        {onSwitchToRegister ? (
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="text-brand-600 font-semibold hover:text-brand-700 transition-colors"
          >
            הרשמו כאן
          </button>
        ) : (
          <Link
            href="/register"
            className="text-brand-600 font-semibold hover:text-brand-700 transition-colors"
          >
            הרשמו כאן
          </Link>
        )}
      </p>
    </div>
  );
}
