"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { User, Phone, Mail, Loader2, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { recordLogin, finalizeNewUserProfile } from "@/app/actions/auth";
import { registerInfoSchema, otpVerifySchema } from "@/lib/validations/auth";
import type { RegisterInfoFormData, OtpVerifyFormData } from "@/lib/validations/auth";

interface RegisterFormProps {
  /**
   * Called after a successful signup. When provided, the form does NOT navigate —
   * the caller handles what happens next. When omitted (standalone page), the form redirects.
   */
  onSuccess?: () => void;
  /**
   * When rendered inside a modal, called to switch to the login tab.
   * When omitted, links/buttons navigate to /login instead.
   */
  onSwitchToLogin?: () => void;
}

/**
 * Registration flow phases:
 *
 * "info"  → User enters phone + full name + email (all collected BEFORE OTP is sent).
 *            No Supabase session exists at this point — closing the modal is fully safe.
 *
 * "otp"     → User enters the 6-digit SMS code. On success the profile is saved
 *              immediately in the same handler. If the profile save fails we sign out
 *              to prevent ghost-auth state. No separate "profile" phase exists.
 *
 * "blocked" → SMS rate limit hit on the initial send. Shows retry time and prompts
 *              the user to come back later. No email fallback in registration.
 */
type Phase = "info" | "otp" | "blocked";

/** Convert Israeli local format to E.164: 0501234567 → +972501234567 */
function toE164(phone: string): string {
  const clean = phone.replace(/[\s\-\(\)]/g, "");
  if (clean.startsWith("0")) return "+972" + clean.slice(1);
  if (clean.startsWith("+")) return clean;
  return "+972" + clean;
}

export function RegisterForm({ onSuccess, onSwitchToLogin }: RegisterFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [phase, setPhase] = useState<Phase>("info");
  const [e164Phone, setE164Phone] = useState("");
  const [displayPhone, setDisplayPhone] = useState("");
  // Collected in the info phase, consumed when saving the profile after OTP.
  const [pendingProfile, setPendingProfile] = useState<{ full_name: string; email: string } | null>(null);
  const [serverError, setServerError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [blockedRetryAt, setBlockedRetryAt] = useState<string | null>(null);

  const infoForm = useForm<RegisterInfoFormData>({
    resolver: zodResolver(registerInfoSchema),
  });

  const otpForm = useForm<OtpVerifyFormData>({
    resolver: zodResolver(otpVerifySchema),
  });

  // Resend cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  /** Step 1 — validate info, check phone uniqueness, then send OTP */
  const handleSubmitInfo = async (data: RegisterInfoFormData) => {
    setServerError("");
    const normalized = toE164(data.phone);

    // Gate: block registration if this phone already has an account
    const checkRes = await fetch("/api/auth/check-phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: normalized }),
    });
    if (!checkRes.ok) {
      setServerError("שגיאה בבדיקת המספר. נסו שוב.");
      return;
    }
    const { exists } = await checkRes.json();
    if (exists) {
      setServerError("משתמש עם מספר זה כבר קיים, נא להתחבר");
      return;
    }

    const otpRes = await fetch("/api/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: normalized, isRegistration: true }),
    });

    if (!otpRes.ok) {
      if (otpRes.status === 429) {
        const body = await otpRes.json().catch(() => ({}));
        if (body.blocked) {
          setBlockedRetryAt(body.retryAt ?? null);
          setE164Phone(normalized);
          setDisplayPhone(data.phone);
          setPhase("blocked");
          return;
        }
        setServerError("אנא המתינו מספר שניות לפני שליחה חוזרת.");
      } else {
        const body = await otpRes.json().catch(() => ({}));
        setServerError(body.error ?? "שגיאה בשליחת הקוד. נסו שוב.");
      }
      return;
    }

    // Stash collected details — will be saved to the profile after OTP verification.
    // No Supabase session has been created yet; closing the modal at this phase is safe.
    setE164Phone(normalized);
    setDisplayPhone(data.phone);
    setPendingProfile({ full_name: data.full_name, email: data.email });
    setCooldown(60);
    setPhase("otp");
  };

  /**
   * Step 2 — verify OTP, then immediately save profile in the same handler.
   *
   * Why: verifyOtp() creates a live Supabase session immediately. If we let the user
   * reach a separate "profile" phase and they close the modal before completing it,
   * the session remains active and the header shows them as logged in — ghost auth.
   *
   * Fix: save the profile atomically in this handler. If the profile save fails,
   * sign out before showing the error so the app is never left in a partial-auth state.
   */
  const handleVerifyOtp = async (data: OtpVerifyFormData) => {
    setServerError("");
    const supabase = createClient();

    const { error: otpError } = await supabase.auth.verifyOtp({
      phone: e164Phone,
      token: data.token,
      type: "sms",
    });

    if (otpError) {
      const msg = otpError.message.toLowerCase();
      // Supabase returns "Token has expired or is invalid" for BOTH wrong code and
      // expired code. Check for the combined phrase first to avoid showing the
      // misleading "expired" message when the user simply mistyped the digits.
      if (msg.includes("expired") && msg.includes("invalid")) {
        setServerError("הקוד שהוזן שגוי. בדקו שהקלדתם נכון, או שלחו קוד חדש.");
      } else if (msg.includes("expired")) {
        setServerError("קוד האימות פג תוקף. שלחו קוד חדש.");
      } else if (msg.includes("invalid")) {
        setServerError("הקוד שהוזן שגוי. נסו שוב.");
      } else {
        setServerError("שגיאה באימות. נסו שוב.");
      }
      return;
    }

    // ── OTP verified: session now exists ────────────────────────────────────────
    // Save profile immediately. If anything fails from here we sign out to prevent
    // the user from being left in an authenticated-but-incomplete state.

    const profile = pendingProfile;
    if (!profile) {
      // Should never happen (pendingProfile is always set before reaching OTP phase),
      // but guard defensively.
      await supabase.auth.signOut();
      setServerError("שגיאה פנימית. אנא נסו שוב מההתחלה.");
      setPhase("info");
      return;
    }

    // Finalize the profile via server action (uses admin client — bypasses RLS,
    // syncs email to auth.users, writes name to JWT metadata).
    const { error: profileError } = await finalizeNewUserProfile({
      fullName: profile.full_name,
      email: profile.email,
      displayPhone,
    });

    if (profileError) {
      // Sign out to prevent ghost-auth: user has a session but no completed profile.
      await supabase.auth.signOut();
      setServerError(profileError);
      return;
    }

    await completeAuth();
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setServerError("");

    const res = await fetch("/api/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: e164Phone, isRegistration: true }),
    });

    if (!res.ok) {
      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        if (body.blocked) {
          setBlockedRetryAt(body.retryAt ?? null);
          setPhase("blocked");
          return;
        }
        setServerError("אנא המתינו מספר שניות לפני שליחה חוזרת.");
      } else {
        const body = await res.json().catch(() => ({}));
        setServerError(body.error ?? "שגיאה בשליחת הקוד. נסו שוב.");
      }
      return;
    }

    setCooldown(60);
    otpForm.reset();
  };

  const completeAuth = async () => {
    // Record login timestamp in profiles table (DB-backed, admin-client write).
    await recordLogin();
    if (onSuccess) {
      onSuccess();
    } else {
      const next = searchParams.get("next") ?? "/account";
      router.replace(next);
      router.refresh();
    }
  };

  // ── Blocked phase (SMS rate limit hit) ───────────────────────────────────────
  if (phase === "blocked") {
    const retryTime = blockedRetryAt
      ? new Date(blockedRetryAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })
      : null;

    return (
      <div>
        {!onSuccess && (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">הרשמה</h1>
          </>
        )}

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 flex gap-3">
          <Clock className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" aria-hidden="true" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold mb-1">שליחת קודי SMS הוגבלה זמנית</p>
            <p>
              שלחתם מספר קודי אימות בזמן קצר. אנא המתינו ונסו שוב
              {retryTime ? (
                <> לאחר השעה <span dir="ltr" className="font-semibold">{retryTime}</span>.</>
              ) : (
                " מאוחר יותר."
              )}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setPhase("info");
            setServerError("");
            setBlockedRetryAt(null);
          }}
          className="mt-5 w-full h-11 rounded-xl border border-stone-200 bg-white text-gray-700 font-semibold text-sm hover:bg-stone-50 transition-colors"
        >
          חזרה לטופס ההרשמה
        </button>
      </div>
    );
  }

  // ── Info step (phone + name + email) ─────────────────────────────────────────
  if (phase === "info") {
    return (
      <div>
        {!onSuccess && (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">הרשמה</h1>
            <p className="text-base text-stone-500 mb-7">
              הזינו את פרטיכם לפתיחת חשבון
            </p>
          </>
        )}

        <form onSubmit={infoForm.handleSubmit(handleSubmitInfo)} noValidate className="space-y-4">
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
                {...infoForm.register("phone")}
                className={[
                  "w-full h-11 bg-white border rounded-xl ps-10 pe-4 text-sm text-gray-900 placeholder:text-stone-400",
                  "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow",
                  infoForm.formState.errors.phone ? "border-red-400" : "border-stone-200",
                ].join(" ")}
              />
            </div>
            {infoForm.formState.errors.phone && (
              <p className="mt-1.5 text-xs text-red-500">
                {infoForm.formState.errors.phone.message}
              </p>
            )}
          </div>

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
                {...infoForm.register("full_name")}
                className={[
                  "w-full h-11 bg-white border rounded-xl ps-10 pe-4 text-sm text-gray-900 placeholder:text-stone-400",
                  "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow",
                  infoForm.formState.errors.full_name ? "border-red-400" : "border-stone-200",
                ].join(" ")}
              />
            </div>
            {infoForm.formState.errors.full_name && (
              <p className="mt-1.5 text-xs text-red-500">
                {infoForm.formState.errors.full_name.message}
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
                {...infoForm.register("email")}
                className={[
                  "w-full h-11 bg-white border rounded-xl ps-10 pe-4 text-sm text-gray-900 placeholder:text-stone-400",
                  "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow",
                  infoForm.formState.errors.email ? "border-red-400" : "border-stone-200",
                ].join(" ")}
              />
            </div>
            {infoForm.formState.errors.email && (
              <p className="mt-1.5 text-xs text-red-500">
                {infoForm.formState.errors.email.message}
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
            disabled={infoForm.formState.isSubmitting}
            className="w-full h-11 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {infoForm.formState.isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              "שלח קוד אימות"
            )}
          </button>
        </form>

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

  // ── OTP step ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {!onSuccess && (
        <>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">הרשמה</h1>
          <p className="text-base text-stone-500 mb-7">הזינו את קוד האימות שנשלח לטלפון</p>
        </>
      )}

      <p className="text-sm text-stone-600 mb-4">
        שלחנו קוד SMS למספר{" "}
        <span className="font-semibold text-gray-800" dir="ltr">
          {displayPhone}
        </span>
        .{" "}
        <button
          type="button"
          onClick={() => {
            setPhase("info");
            setServerError("");
            otpForm.reset();
          }}
          className="text-brand-600 hover:text-brand-700 transition-colors"
        >
          שינוי פרטים
        </button>
      </p>

      <form onSubmit={otpForm.handleSubmit(handleVerifyOtp)} noValidate className="space-y-4">
        <div>
          <label
            htmlFor="reg-otp"
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            קוד אימות (6 ספרות)
          </label>
          <input
            id="reg-otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            dir="ltr"
            maxLength={6}
            placeholder="123456"
            {...otpForm.register("token")}
            className={[
              "w-full h-11 bg-white border rounded-xl px-4 text-sm text-gray-900 placeholder:text-stone-400 text-center tracking-widest",
              "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow",
              otpForm.formState.errors.token ? "border-red-400" : "border-stone-200",
            ].join(" ")}
          />
          {otpForm.formState.errors.token && (
            <p className="mt-1.5 text-xs text-red-500">
              {otpForm.formState.errors.token.message}
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
          disabled={otpForm.formState.isSubmitting}
          className="w-full h-11 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
        >
          {otpForm.formState.isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            "סיום הרשמה"
          )}
        </button>
      </form>

      <p className="text-center text-sm text-stone-500 mt-5">
        לא קיבלתם קוד?{" "}
        {cooldown > 0 ? (
          <span className="text-stone-400">
            שלח שוב בעוד {cooldown} שניות
          </span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            className="text-brand-600 font-semibold hover:text-brand-700 transition-colors"
          >
            שלח שוב
          </button>
        )}
      </p>
    </div>
  );
}
