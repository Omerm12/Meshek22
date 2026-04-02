"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { User, Phone, Mail, Lock, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { emailPasswordRegisterSchema } from "@/lib/validations/auth";
import type { EmailPasswordRegisterFormData } from "@/lib/validations/auth";

interface RegisterFormProps {
  /**
   * Called after a successful signup with an active session (email confirmation
   * disabled). When provided, the form does NOT navigate — the caller handles
   * what happens next. When omitted (standalone page), the form redirects.
   */
  onSuccess?: () => void;
  /**
   * When rendered inside a modal, called to switch to the login tab.
   * When omitted, links/buttons navigate to /login instead.
   */
  onSwitchToLogin?: () => void;
}

/**
 * Temporary email + password registration.
 * TODO: Replace with phone OTP flow when SMS provider is connected.
 */
export function RegisterForm({ onSuccess, onSwitchToLogin }: RegisterFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [serverError, setServerError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  // Shown when Supabase requires email confirmation before the session is active
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  const form = useForm<EmailPasswordRegisterFormData>({
    resolver: zodResolver(emailPasswordRegisterSchema),
  });

  const onSubmit = async (data: EmailPasswordRegisterFormData) => {
    setServerError("");
    const supabase = createClient();

    // Pass phone in metadata so the DB trigger (handle_new_user) captures it
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.full_name,
          phone: data.phone,
        },
      },
    });

    if (signUpError) {
      if (
        signUpError.message.includes("already registered") ||
        signUpError.message.includes("User already registered")
      ) {
        setServerError("כתובת האימייל הזו כבר רשומה. נסו להתחבר.");
      } else if (signUpError.message.includes("Password should be at least")) {
        setServerError("הסיסמה חייבת להכיל לפחות 6 תווים.");
      } else {
        setServerError("שגיאה בהרשמה. נסו שוב.");
      }
      return;
    }

    // No session → Supabase requires email confirmation before login
    if (!authData.session) {
      setAwaitingConfirmation(true);
      return;
    }

    // Session is active — immediately logged in (email confirmation disabled)
    const userId = authData.user?.id;
    if (userId) {
      // Ensure phone is saved on profile; trigger may have run before metadata was available
      await supabase
        .from("profiles")
        .update({ phone: data.phone, updated_at: new Date().toISOString() })
        .eq("id", userId);
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

  // ── Email confirmation waiting state ──────────────────────────────────────
  if (awaitingConfirmation) {
    return (
      <div className="text-center py-2">
        <div className="h-14 w-14 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="h-7 w-7 text-brand-600" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">בדקו את תיבת הדואר</h2>
        <p className="text-sm text-stone-500 mb-5 leading-relaxed">
          שלחנו אימייל אישור לכתובת{" "}
          <span className="font-semibold text-gray-700" dir="ltr">
            {form.getValues("email")}
          </span>
          .<br />
          לחצו על הקישור כדי לאמת את החשבון ולהתחבר.
        </p>
        {onSwitchToLogin ? (
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="inline-flex items-center justify-center h-10 px-6 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors"
          >
            לכניסה לחשבון
          </button>
        ) : (
          <Link
            href="/login"
            className="inline-flex items-center justify-center h-10 px-6 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors"
          >
            לדף הכניסה
          </Link>
        )}
      </div>
    );
  }

  // ── Registration form ─────────────────────────────────────────────────────
  return (
    <div>
      {/* Title is shown only on the standalone page; modal has its own header */}
      {!onSuccess && (
        <>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">הרשמה</h1>
          <p className="text-sm text-stone-500 mb-7">
            פתחו חשבון כדי לעקוב אחר ההזמנות שלכם
          </p>
        </>
      )}

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="space-y-4"
      >
        {/* Full name */}
        <div>
          <label
            htmlFor="reg-full_name"
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            שם מלא <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <User
              className="absolute top-1/2 -translate-y-1/2 start-3.5 h-4 w-4 text-stone-400 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="reg-full_name"
              type="text"
              autoComplete="name"
              placeholder="ישראל ישראלי"
              {...form.register("full_name")}
              className={[
                "w-full h-11 bg-white border rounded-xl ps-10 pe-4 text-sm text-gray-900 placeholder:text-stone-400",
                "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow",
                form.formState.errors.full_name
                  ? "border-red-400"
                  : "border-stone-200",
              ].join(" ")}
            />
          </div>
          {form.formState.errors.full_name && (
            <p className="mt-1.5 text-xs text-red-500">
              {form.formState.errors.full_name.message}
            </p>
          )}
        </div>

        {/* Email */}
        <div>
          <label
            htmlFor="reg-email"
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            כתובת אימייל <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Mail
              className="absolute top-1/2 -translate-y-1/2 start-3.5 h-4 w-4 text-stone-400 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="reg-email"
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

        {/* Phone */}
        <div>
          <label
            htmlFor="reg-phone"
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            מספר טלפון נייד <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Phone
              className="absolute top-1/2 -translate-y-1/2 start-3.5 h-4 w-4 text-stone-400 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="reg-phone"
              type="tel"
              autoComplete="tel"
              dir="ltr"
              placeholder="0501234567"
              {...form.register("phone")}
              className={[
                "w-full h-11 bg-white border rounded-xl ps-10 pe-4 text-sm text-gray-900 placeholder:text-stone-400",
                "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow",
                form.formState.errors.phone
                  ? "border-red-400"
                  : "border-stone-200",
              ].join(" ")}
            />
          </div>
          {form.formState.errors.phone && (
            <p className="mt-1.5 text-xs text-red-500">
              {form.formState.errors.phone.message}
            </p>
          )}
        </div>

        {/* Password */}
        <div>
          <label
            htmlFor="reg-password"
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            סיסמה <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Lock
              className="absolute top-1/2 -translate-y-1/2 start-3.5 h-4 w-4 text-stone-400 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="reg-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              dir="ltr"
              placeholder="לפחות 6 תווים"
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

        {/* Confirm password */}
        <div>
          <label
            htmlFor="reg-confirm_password"
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            אימות סיסמה <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Lock
              className="absolute top-1/2 -translate-y-1/2 start-3.5 h-4 w-4 text-stone-400 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="reg-confirm_password"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              dir="ltr"
              placeholder="הזינו שוב את הסיסמה"
              {...form.register("confirm_password")}
              className={[
                "w-full h-11 bg-white border rounded-xl ps-10 pe-10 text-sm text-gray-900 placeholder:text-stone-400",
                "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow",
                form.formState.errors.confirm_password
                  ? "border-red-400"
                  : "border-stone-200",
              ].join(" ")}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute top-1/2 -translate-y-1/2 end-3.5 text-stone-400 hover:text-stone-600 transition-colors"
              aria-label={showConfirm ? "הסתר סיסמה" : "הצג סיסמה"}
            >
              {showConfirm ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {form.formState.errors.confirm_password && (
            <p className="mt-1.5 text-xs text-red-500">
              {form.formState.errors.confirm_password.message}
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
            "הרשמה"
          )}
        </button>
      </form>

      {/* Switch to login */}
      <p className="text-center text-sm text-stone-500 mt-5">
        יש לכם כבר חשבון?{" "}
        {onSwitchToLogin ? (
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-brand-600 font-semibold hover:text-brand-700 transition-colors"
          >
            כניסה
          </button>
        ) : (
          <Link
            href="/login"
            className="text-brand-600 font-semibold hover:text-brand-700 transition-colors"
          >
            כניסה
          </Link>
        )}
      </p>
    </div>
  );
}
