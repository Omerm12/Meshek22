"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { User, Phone, Mail, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { recordLogin } from "@/app/actions/auth";
import { phoneOtpSchema, otpVerifySchema, profileSchema } from "@/lib/validations/auth";
import type { PhoneOtpFormData, OtpVerifyFormData, ProfileFormData } from "@/lib/validations/auth";

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

type Phase = "phone" | "otp" | "profile";

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

  const [phase, setPhase] = useState<Phase>("phone");
  const [e164Phone, setE164Phone] = useState("");
  const [displayPhone, setDisplayPhone] = useState("");
  const [serverError, setServerError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const phoneForm = useForm<PhoneOtpFormData>({
    resolver: zodResolver(phoneOtpSchema),
  });

  const otpForm = useForm<OtpVerifyFormData>({
    resolver: zodResolver(otpVerifySchema),
  });

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  });

  // Resend cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleSendOtp = async (data: PhoneOtpFormData) => {
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

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({ phone: normalized });

    if (error) {
      if (error.message.includes("rate") || error.message.includes("too many")) {
        setServerError("יותר מדי ניסיונות. אנא המתינו מספר דקות.");
      } else if (error.message.includes("invalid") && error.message.includes("phone")) {
        setServerError("מספר הטלפון אינו תקין.");
      } else {
        setServerError("שגיאה בשליחת הקוד. נסו שוב.");
      }
      return;
    }

    setE164Phone(normalized);
    setDisplayPhone(data.phone);
    setCooldown(60);
    setPhase("otp");
  };

  const handleVerifyOtp = async (data: OtpVerifyFormData) => {
    setServerError("");
    const supabase = createClient();

    const { error } = await supabase.auth.verifyOtp({
      phone: e164Phone,
      token: data.token,
      type: "sms",
    });

    if (error) {
      if (
        error.message.includes("expired") ||
        error.message.includes("Token has expired")
      ) {
        setServerError("קוד האימות פג תוקף. שלחו קוד חדש.");
      } else if (
        error.message.includes("invalid") ||
        error.message.includes("Invalid")
      ) {
        setServerError("קוד האימות שגוי. נסו שוב.");
      } else {
        setServerError("שגיאה באימות. נסו שוב.");
      }
      return;
    }

    // Check if the user already has a complete profile
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
      // Returning user with complete profile — done
      await completeAuth();
    } else {
      // New user or incomplete profile — collect details
      setPhase("profile");
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setServerError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({ phone: e164Phone });
    if (error) {
      setServerError("שגיאה בשליחת הקוד. נסו שוב.");
      return;
    }
    setCooldown(60);
    otpForm.reset();
  };

  const handleSaveProfile = async (data: ProfileFormData) => {
    setServerError("");
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setServerError("שגיאה בשמירת הפרטים. נסו שוב.");
      return;
    }

    // Update the user's metadata with the name (for display/JWT)
    await supabase.auth.updateUser({
      data: { full_name: data.full_name },
    });

    // Save profile details
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: data.full_name,
        email: data.email,
        phone: displayPhone,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      setServerError("שגיאה בשמירת הפרטים. נסו שוב.");
      return;
    }

    await completeAuth();
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

  // ── Phone step ───────────────────────────────────────────────────────────────
  if (phase === "phone") {
    return (
      <div>
        {!onSuccess && (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">הרשמה</h1>
            <p className="text-sm text-stone-500 mb-7">
              הזינו את מספר הטלפון כדי להתחיל
            </p>
          </>
        )}

        <form onSubmit={phoneForm.handleSubmit(handleSendOtp)} noValidate className="space-y-4">
          <div>
            <label
              htmlFor="reg-phone"
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              מספר טלפון נייד
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
                {...phoneForm.register("phone")}
                className={[
                  "w-full h-11 bg-white border rounded-xl ps-10 pe-4 text-sm text-gray-900 placeholder:text-stone-400",
                  "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow",
                  phoneForm.formState.errors.phone
                    ? "border-red-400"
                    : "border-stone-200",
                ].join(" ")}
              />
            </div>
            {phoneForm.formState.errors.phone && (
              <p className="mt-1.5 text-xs text-red-500">
                {phoneForm.formState.errors.phone.message}
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
            disabled={phoneForm.formState.isSubmitting}
            className="w-full h-11 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {phoneForm.formState.isSubmitting ? (
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
  if (phase === "otp") {
    return (
      <div>
        {!onSuccess && (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">הרשמה</h1>
            <p className="text-sm text-stone-500 mb-7">הזינו את קוד האימות שנשלח לטלפון</p>
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
              setPhase("phone");
              setServerError("");
              otpForm.reset();
            }}
            className="text-brand-600 hover:text-brand-700 transition-colors"
          >
            שינוי מספר
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
              "אמת קוד"
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

  // ── Profile step (new users) ─────────────────────────────────────────────────
  return (
    <div>
      {!onSuccess && (
        <>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">השלמת פרטים</h1>
          <p className="text-sm text-stone-500 mb-7">
            עוד שלב אחד — הזינו את פרטיכם
          </p>
        </>
      )}

      {onSuccess && (
        <p className="text-sm text-stone-500 mb-5">
          ברוכים הבאים! הזינו את פרטיכם להשלמת ההרשמה.
        </p>
      )}

      <form
        onSubmit={profileForm.handleSubmit(handleSaveProfile)}
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
              {...profileForm.register("full_name")}
              className={[
                "w-full h-11 bg-white border rounded-xl ps-10 pe-4 text-sm text-gray-900 placeholder:text-stone-400",
                "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow",
                profileForm.formState.errors.full_name
                  ? "border-red-400"
                  : "border-stone-200",
              ].join(" ")}
            />
          </div>
          {profileForm.formState.errors.full_name && (
            <p className="mt-1.5 text-xs text-red-500">
              {profileForm.formState.errors.full_name.message}
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
              {...profileForm.register("email")}
              className={[
                "w-full h-11 bg-white border rounded-xl ps-10 pe-4 text-sm text-gray-900 placeholder:text-stone-400",
                "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow",
                profileForm.formState.errors.email
                  ? "border-red-400"
                  : "border-stone-200",
              ].join(" ")}
            />
          </div>
          {profileForm.formState.errors.email && (
            <p className="mt-1.5 text-xs text-red-500">
              {profileForm.formState.errors.email.message}
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
          disabled={profileForm.formState.isSubmitting}
          className="w-full h-11 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
        >
          {profileForm.formState.isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            "סיום הרשמה"
          )}
        </button>
      </form>
    </div>
  );
}
