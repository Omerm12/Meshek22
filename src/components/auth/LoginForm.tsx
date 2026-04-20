"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Phone, User, Mail, Loader2, Clock, MailOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { recordLogin, finalizeNewUserProfile } from "@/app/actions/auth";
import { phoneOtpSchema, otpVerifySchema, emailOtpVerifySchema, profileSchema } from "@/lib/validations/auth";
import type { PhoneOtpFormData, OtpVerifyFormData, EmailOtpVerifyFormData, ProfileFormData } from "@/lib/validations/auth";

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

// ── Phase types ───────────────────────────────────────────────────────────────

/** phone → otp (SMS) or blocked (rate limited) → email-otp (fallback) → profile */
type Phase = "phone" | "otp" | "blocked" | "email-otp" | "profile";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert Israeli local format to E.164: 0501234567 → +972501234567 */
function toE164(phone: string): string {
  const clean = phone.replace(/[\s\-\(\)]/g, "");
  if (clean.startsWith("0")) return "+972" + clean.slice(1);
  if (clean.startsWith("+")) return clean;
  return "+972" + clean;
}

/** Format an ISO timestamp as HH:MM in local time (for "try again at" display) */
function toLocalTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LoginForm({ onSuccess, onSwitchToRegister }: LoginFormProps) {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [phase, setPhase]             = useState<Phase>("phone");
  const [e164Phone, setE164Phone]     = useState("");
  const [displayPhone, setDisplayPhone] = useState("");
  const [serverError, setServerError] = useState("");
  const [cooldown, setCooldown]       = useState(0);

  // ── SMS-blocked state ──────────────────────────────────────────────────────
  const [blockedRetryAt, setBlockedRetryAt]         = useState<string | null>(null);
  const [emailFallback, setEmailFallback]           = useState<{
    email: string;       // full email — needed for verifyOtp
    masked: string;      // display only
  } | null>(null);

  // ── Email-OTP state ────────────────────────────────────────────────────────
  const [emailOtpAddress, setEmailOtpAddress]       = useState(""); // full, for verifyOtp
  const [emailOtpMasked, setEmailOtpMasked]         = useState(""); // display
  const [emailOtpLoading, setEmailOtpLoading]       = useState(false);
  const [emailOtpSent, setEmailOtpSent]             = useState(false);

  const phoneForm   = useForm<PhoneOtpFormData>({ resolver: zodResolver(phoneOtpSchema) });
  const otpForm     = useForm<OtpVerifyFormData>({ resolver: zodResolver(otpVerifySchema) });
  const emailOtpForm = useForm<EmailOtpVerifyFormData>({ resolver: zodResolver(emailOtpVerifySchema) });
  const profileForm = useForm<ProfileFormData>({ resolver: zodResolver(profileSchema) });

  // Resend cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  // ── Step 1: Send SMS OTP ───────────────────────────────────────────────────
  const handleSendOtp = async (data: PhoneOtpFormData) => {
    setServerError("");
    const normalized = toE164(data.phone);

    // Gate: only existing users may log in via the login tab.
    const checkRes = await fetch("/api/auth/check-phone", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ phone: normalized }),
    });
    if (!checkRes.ok) {
      setServerError("שגיאה בבדיקת המספר. נסו שוב.");
      return;
    }
    const { exists } = await checkRes.json();
    if (!exists) {
      setServerError("לא קיים חשבון עם מספר זה. נא להירשם.");
      return;
    }

    const res = await fetch("/api/auth/send-otp", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ phone: normalized, isRegistration: false }),
    });

    const json = await res.json();

    if (res.status === 429 && json.blocked) {
      // SMS rate limit hit — switch to the blocked phase.
      setE164Phone(normalized);
      setDisplayPhone(data.phone);
      setBlockedRetryAt(json.retryAt ?? null);
      setEmailFallback(
        json.hasEmailFallback && json.email
          ? { email: json.email, masked: json.maskedEmail }
          : null,
      );
      setPhase("blocked");
      return;
    }

    if (!res.ok) {
      setServerError(json.error ?? "שגיאה בשליחת הקוד. נסו שוב.");
      return;
    }

    setE164Phone(normalized);
    setDisplayPhone(data.phone);
    setCooldown(60);
    setPhase("otp");
  };

  // ── Step 2a: Verify SMS OTP ────────────────────────────────────────────────
  const handleVerifyOtp = async (data: OtpVerifyFormData) => {
    setServerError("");
    const supabase = createClient();

    const { error } = await supabase.auth.verifyOtp({
      phone: e164Phone,
      token: data.token,
      type:  "sms",
    });

    if (error) {
      setServerError(translateOtpError(error.message));
      return;
    }

    await afterVerification(supabase);
  };

  // ── Resend SMS (from OTP phase) ────────────────────────────────────────────
  const handleResend = async () => {
    if (cooldown > 0) return;
    setServerError("");

    const res  = await fetch("/api/auth/send-otp", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ phone: e164Phone, isRegistration: false }),
    });
    const json = await res.json();

    if (res.status === 429 && json.blocked) {
      // Hit limit during resend — show the retry time inline.
      const timeStr = json.retryAt ? toLocalTime(json.retryAt) : "";
      setServerError(
        timeStr
          ? `שלחת 3 בקשות SMS בשעה האחרונה. ניתן לנסות שוב לאחר השעה ${timeStr}.`
          : "שלחת יותר מדי בקשות. אנא המתינו.",
      );
      return;
    }

    if (!res.ok) {
      setServerError(json.error ?? "שגיאה בשליחת הקוד. נסו שוב.");
      return;
    }

    setCooldown(60);
    otpForm.reset();
  };

  // ── Email fallback: send email OTP ────────────────────────────────────────
  const handleSendEmailOtp = async () => {
    setEmailOtpLoading(true);
    setServerError("");

    const res  = await fetch("/api/auth/send-email-otp", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ phone: e164Phone }),
    });
    const json = await res.json();
    setEmailOtpLoading(false);

    if (res.status === 429 && json.blocked) {
      const timeStr = json.retryAt ? toLocalTime(json.retryAt) : "";
      setServerError(
        timeStr
          ? `שלחת יותר מדי בקשות אימייל. ניתן לנסות שוב לאחר השעה ${timeStr}.`
          : "יותר מדי ניסיונות. נסו מאוחר יותר.",
      );
      return;
    }

    if (!res.ok) {
      setServerError(json.error ?? "שגיאה בשליחת הקוד לאימייל. נסו שוב.");
      return;
    }

    setEmailOtpAddress(json.email);
    setEmailOtpMasked(json.maskedEmail ?? json.email);
    setEmailOtpSent(true);
    setPhase("email-otp");
  };

  // ── Step 2b: Verify email OTP ─────────────────────────────────────────────
  const handleVerifyEmailOtp = async (data: EmailOtpVerifyFormData) => {
    setServerError("");
    const supabase = createClient();

    const { error } = await supabase.auth.verifyOtp({
      email: emailOtpAddress,
      token: data.token,
      type:  "email",
    });

    if (error) {
      setServerError(translateOtpError(error.message));
      return;
    }

    await afterVerification(supabase);
  };

  // ── After OTP verified (either channel) ───────────────────────────────────
  async function afterVerification(supabase: ReturnType<typeof createClient>) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setServerError("שגיאה בכניסה. נסו שוב.");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.full_name) {
      await completeAuth();
    } else {
      setPhase("profile");
    }
  }

  // ── Profile completion (new users only) ───────────────────────────────────
  const handleSaveProfile = async (data: ProfileFormData) => {
    setServerError("");

    const { error } = await finalizeNewUserProfile({
      fullName:     data.full_name,
      email:        data.email,
      displayPhone: displayPhone,
    });

    if (error) {
      setServerError(error);
      return;
    }

    await completeAuth();
  };

  // ── Finish auth ───────────────────────────────────────────────────────────
  const completeAuth = async () => {
    await recordLogin();
    if (onSuccess) {
      onSuccess();
    } else {
      const next = searchParams.get("next") ?? "/account";
      router.replace(next);
      router.refresh();
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDERS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Phone step ─────────────────────────────────────────────────────────────
  if (phase === "phone") {
    return (
      <div>
        {!onSuccess && (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">כניסה לחשבון</h1>
            <p className="text-base text-stone-500 mb-7">הזינו את מספר הטלפון שלכם</p>
          </>
        )}

        <form onSubmit={phoneForm.handleSubmit(handleSendOtp)} noValidate className="space-y-4">
          <div>
            <label htmlFor="login-phone" className="block text-sm font-medium text-gray-700 mb-1.5">
              מספר טלפון נייד
            </label>
            <div className="relative">
              <Phone
                className="absolute top-1/2 -translate-y-1/2 start-3.5 h-4 w-4 text-stone-400 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="login-phone"
                type="tel"
                autoComplete="tel"
                dir="ltr"
                placeholder="0501234567"
                {...phoneForm.register("phone")}
                className={[
                  "w-full h-11 bg-white border rounded-xl ps-4 pe-10 text-sm text-gray-900 placeholder:text-stone-400",
                  "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow",
                  phoneForm.formState.errors.phone ? "border-red-400" : "border-stone-200",
                ].join(" ")}
              />
            </div>
            {phoneForm.formState.errors.phone && (
              <p className="mt-1.5 text-xs text-red-500">{phoneForm.formState.errors.phone.message}</p>
            )}
          </div>

          {serverError && <ErrorBanner>{serverError}</ErrorBanner>}

          <button
            type="submit"
            disabled={phoneForm.formState.isSubmitting}
            className="w-full h-11 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {phoneForm.formState.isSubmitting
              ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              : "שלח קוד אימות"}
          </button>
        </form>

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
            <Link href="/register" className="text-brand-600 font-semibold hover:text-brand-700 transition-colors">
              הרשמו כאן
            </Link>
          )}
        </p>
      </div>
    );
  }

  // ── OTP step (SMS) ─────────────────────────────────────────────────────────
  if (phase === "otp") {
    return (
      <div>
        {!onSuccess && (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">כניסה לחשבון</h1>
            <p className="text-base text-stone-500 mb-7">הזינו את קוד האימות שנשלח לטלפון</p>
          </>
        )}

        <p className="text-sm text-stone-600 mb-4">
          שלחנו קוד SMS למספר{" "}
          <span className="font-semibold text-gray-800" dir="ltr">{displayPhone}</span>.{" "}
          <button
            type="button"
            onClick={() => { setPhase("phone"); setServerError(""); otpForm.reset(); }}
            className="text-brand-600 hover:text-brand-700 transition-colors"
          >
            שינוי מספר
          </button>
        </p>

        <form onSubmit={otpForm.handleSubmit(handleVerifyOtp)} noValidate className="space-y-4">
          <OtpInput id="login-otp" form={otpForm} />

          {serverError && <ErrorBanner>{serverError}</ErrorBanner>}

          <button
            type="submit"
            disabled={otpForm.formState.isSubmitting}
            className="w-full h-11 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {otpForm.formState.isSubmitting
              ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              : "כניסה"}
          </button>
        </form>

        <p className="text-center text-sm text-stone-500 mt-5">
          לא קיבלתם קוד?{" "}
          {cooldown > 0 ? (
            <span className="text-stone-400">שלח שוב בעוד {cooldown} שניות</span>
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

  // ── Blocked step (SMS rate limit hit) ─────────────────────────────────────
  if (phase === "blocked") {
    const retryTimeStr = blockedRetryAt ? toLocalTime(blockedRetryAt) : "";

    return (
      <div>
        {!onSuccess && (
          <h1 className="text-2xl font-bold text-gray-900 mb-6">כניסה לחשבון</h1>
        )}

        {/* Rate limit notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <div className="flex gap-3">
            <Clock className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-amber-800 mb-1">
                שלחת 3 בקשות SMS בשעה האחרונה
              </p>
              {retryTimeStr ? (
                <p className="text-sm text-amber-700">
                  ניתן לבקש קוד SMS חדש לאחר השעה{" "}
                  <span className="font-semibold" dir="ltr">{retryTimeStr}</span>.
                </p>
              ) : (
                <p className="text-sm text-amber-700">ניתן לנסות שוב בעוד כשעה.</p>
              )}
            </div>
          </div>
        </div>

        {/* Email fallback offer */}
        {emailFallback ? (
          <div className="space-y-3">
            <p className="text-sm text-stone-600">
              לחלופין, נשלח קוד כניסה לכתובת האימייל{" "}
              <span className="font-semibold text-gray-800" dir="ltr">{emailFallback.masked}</span>
            </p>

            {serverError && <ErrorBanner>{serverError}</ErrorBanner>}

            <button
              type="button"
              onClick={handleSendEmailOtp}
              disabled={emailOtpLoading}
              className="w-full h-11 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {emailOtpLoading
                ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                : <><MailOpen className="h-4 w-4" aria-hidden="true" />שלח קוד לאימייל</>}
            </button>
          </div>
        ) : (
          <>
            {serverError && <ErrorBanner>{serverError}</ErrorBanner>}
            <p className="text-sm text-stone-500">
              לא קיימת כתובת אימייל מקושרת לחשבון זה. ניתן להמתין ולנסות שוב מאוחר יותר.
            </p>
          </>
        )}

        <button
          type="button"
          onClick={() => { setPhase("phone"); setServerError(""); phoneForm.reset(); }}
          className="w-full mt-4 text-sm text-stone-500 hover:text-stone-700 transition-colors"
        >
          חזרה לשינוי מספר טלפון
        </button>
      </div>
    );
  }

  // ── Email OTP step ─────────────────────────────────────────────────────────
  if (phase === "email-otp") {
    return (
      <div>
        {!onSuccess && (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">כניסה לחשבון</h1>
            <p className="text-base text-stone-500 mb-7">הזינו את קוד האימות בן 8 הספרות שנשלח לאימייל</p>
          </>
        )}

        <p className="text-sm text-stone-600 mb-4">
          שלחנו קוד לכתובת{" "}
          <span className="font-semibold text-gray-800" dir="ltr">{emailOtpMasked}</span>.{" "}
          <button
            type="button"
            onClick={() => { setPhase("blocked"); setServerError(""); emailOtpForm.reset(); }}
            className="text-brand-600 hover:text-brand-700 transition-colors"
          >
            חזרה
          </button>
        </p>

        <form onSubmit={emailOtpForm.handleSubmit(handleVerifyEmailOtp)} noValidate className="space-y-4">
          <OtpInput id="login-email-otp" form={emailOtpForm} digits={8} />

          {serverError && <ErrorBanner>{serverError}</ErrorBanner>}

          <button
            type="submit"
            disabled={emailOtpForm.formState.isSubmitting}
            className="w-full h-11 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {emailOtpForm.formState.isSubmitting
              ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              : "כניסה"}
          </button>
        </form>

        {emailOtpSent && (
          <p className="text-center text-sm text-stone-500 mt-5">
            לא קיבלתם קוד? בדקו את תיקיית הספאם.
          </p>
        )}
      </div>
    );
  }

  // ── Profile step (new users — after OTP, if no full_name in DB) ────────────
  return (
    <div>
      {!onSuccess && (
        <>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">השלמת פרטים</h1>
          <p className="text-base text-stone-500 mb-7">עוד שלב אחד — הזינו את פרטיכם</p>
        </>
      )}
      {onSuccess && (
        <p className="text-sm text-stone-500 mb-5">ברוכים הבאים! הזינו את פרטיכם להשלמת ההרשמה.</p>
      )}

      <form onSubmit={profileForm.handleSubmit(handleSaveProfile)} noValidate className="space-y-4">
        <div>
          <label htmlFor="login-profile-name" className="block text-sm font-medium text-gray-700 mb-1.5">
            שם מלא <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <User
              className="absolute top-1/2 -translate-y-1/2 start-3.5 h-4 w-4 text-stone-400 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="login-profile-name"
              type="text"
              autoComplete="name"
              placeholder="ישראל ישראלי"
              {...profileForm.register("full_name")}
              className={[
                "w-full h-11 bg-white border rounded-xl ps-10 pe-4 text-sm text-gray-900 placeholder:text-stone-400",
                "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow",
                profileForm.formState.errors.full_name ? "border-red-400" : "border-stone-200",
              ].join(" ")}
            />
          </div>
          {profileForm.formState.errors.full_name && (
            <p className="mt-1.5 text-xs text-red-500">{profileForm.formState.errors.full_name.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="login-profile-email" className="block text-sm font-medium text-gray-700 mb-1.5">
            כתובת אימייל <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Mail
              className="absolute top-1/2 -translate-y-1/2 start-3.5 h-4 w-4 text-stone-400 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="login-profile-email"
              type="email"
              autoComplete="email"
              dir="ltr"
              placeholder="you@example.com"
              {...profileForm.register("email")}
              className={[
                "w-full h-11 bg-white border rounded-xl ps-10 pe-4 text-sm text-gray-900 placeholder:text-stone-400",
                "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow",
                profileForm.formState.errors.email ? "border-red-400" : "border-stone-200",
              ].join(" ")}
            />
          </div>
          {profileForm.formState.errors.email && (
            <p className="mt-1.5 text-xs text-red-500">{profileForm.formState.errors.email.message}</p>
          )}
        </div>

        {serverError && <ErrorBanner>{serverError}</ErrorBanner>}

        <button
          type="submit"
          disabled={profileForm.formState.isSubmitting}
          className="w-full h-11 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
        >
          {profileForm.formState.isSubmitting
            ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            : "סיום הרשמה"}
        </button>
      </form>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
      {children}
    </p>
  );
}

function OtpInput({
  id,
  form,
  digits = 6,
}: {
  id: string;
  form: ReturnType<typeof useForm<OtpVerifyFormData>> | ReturnType<typeof useForm<EmailOtpVerifyFormData>>;
  digits?: 6 | 8;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1.5">
        קוד אימות ({digits} ספרות)
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        dir="ltr"
        maxLength={digits}
        placeholder={digits === 8 ? "12345678" : "123456"}
        {...form.register("token")}
        className={[
          "w-full h-11 bg-white border rounded-xl px-4 text-sm text-gray-900 placeholder:text-stone-400 text-center tracking-widest",
          "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow",
          form.formState.errors.token ? "border-red-400" : "border-stone-200",
        ].join(" ")}
      />
      {form.formState.errors.token && (
        <p className="mt-1.5 text-xs text-red-500">{form.formState.errors.token.message}</p>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function translateOtpError(message: string): string {
  const msg = message.toLowerCase();
  // Supabase returns "Token has expired or is invalid" for BOTH wrong code and
  // expired code. Check the combined phrase first to avoid showing the misleading
  // "expired" message when the user simply mistyped.
  if (msg.includes("expired") && msg.includes("invalid")) {
    return "הקוד שהוזן שגוי. בדקו שהקלדתם נכון, או שלחו קוד חדש.";
  }
  if (msg.includes("expired")) return "קוד האימות פג תוקף. שלחו קוד חדש.";
  if (msg.includes("invalid"))  return "הקוד שהוזן שגוי. נסו שוב.";
  return "שגיאה באימות. נסו שוב.";
}
