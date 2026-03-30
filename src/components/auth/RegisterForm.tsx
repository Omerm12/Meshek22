"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { User, Phone, Mail, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { registerSchema, type RegisterFormData } from "@/lib/validations/auth";

export function RegisterForm() {
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setServerError("");
    const supabase = createClient();
    const origin = window.location.origin;

    // signInWithOtp with shouldCreateUser: true creates a new user;
    // the DB trigger sets full_name from raw_user_meta_data.
    const { error } = await supabase.auth.signInWithOtp({
      email: data.email,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
        shouldCreateUser: true,
        data: {
          full_name: data.full_name,
          phone: data.phone ?? null,
        },
      },
    });

    if (error) {
      setServerError("שגיאה בשליחת הקישור. נסו שנית.");
      return;
    }

    setSentEmail(data.email);
    setSent(true);
  };

  if (sent) {
    return (
      <div className="text-center">
        <div className="h-14 w-14 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="h-7 w-7 text-brand-600" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">ברוכים הבאים!</h1>
        <p className="text-sm text-stone-500 leading-relaxed mb-6">
          שלחנו קישור כניסה ל-
          <strong className="text-gray-700 font-semibold">{sentEmail}</strong>.
          {" "}לחצו עליו כדי להשלים את ההרשמה.
        </p>
        <p className="text-xs text-stone-400">
          לא קיבלתם?{" "}
          <button
            onClick={() => setSent(false)}
            className="text-brand-600 font-semibold hover:text-brand-700 transition-colors"
          >
            שלחו שוב
          </button>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">הרשמה</h1>
      <p className="text-sm text-stone-500 mb-7">
        פתחו חשבון כדי לעקוב אחר ההזמנות שלכם
      </p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {/* Full name */}
        <div>
          <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1.5">
            שם מלא
          </label>
          <div className="relative">
            <User
              className="absolute top-1/2 -translate-y-1/2 start-3.5 h-4 w-4 text-stone-400 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="full_name"
              type="text"
              autoComplete="name"
              placeholder="ישראל ישראלי"
              {...register("full_name")}
              className={[
                "w-full h-11 bg-white border rounded-xl ps-10 pe-4 text-sm text-gray-900 placeholder:text-stone-400",
                "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow",
                errors.full_name ? "border-red-400" : "border-stone-200",
              ].join(" ")}
            />
          </div>
          {errors.full_name && (
            <p className="mt-1.5 text-xs text-red-500">{errors.full_name.message}</p>
          )}
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5">
            טלפון{" "}
            <span className="text-stone-400 font-normal">(לא חובה)</span>
          </label>
          <div className="relative">
            <Phone
              className="absolute top-1/2 -translate-y-1/2 start-3.5 h-4 w-4 text-stone-400 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              dir="ltr"
              placeholder="0501234567"
              {...register("phone")}
              className={[
                "w-full h-11 bg-white border rounded-xl ps-10 pe-4 text-sm text-gray-900 placeholder:text-stone-400",
                "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow",
                errors.phone ? "border-red-400" : "border-stone-200",
              ].join(" ")}
            />
          </div>
          {errors.phone && (
            <p className="mt-1.5 text-xs text-red-500">{errors.phone.message}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
            כתובת אימייל
          </label>
          <div className="relative">
            <Mail
              className="absolute top-1/2 -translate-y-1/2 start-3.5 h-4 w-4 text-stone-400 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="email"
              type="email"
              autoComplete="email"
              dir="ltr"
              placeholder="you@example.com"
              {...register("email")}
              className={[
                "w-full h-11 bg-white border rounded-xl ps-10 pe-4 text-sm text-gray-900 placeholder:text-stone-400",
                "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow",
                errors.email ? "border-red-400" : "border-stone-200",
              ].join(" ")}
            />
          </div>
          {errors.email && (
            <p className="mt-1.5 text-xs text-red-500">{errors.email.message}</p>
          )}
        </div>

        {serverError && (
          <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">
            {serverError}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-11 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <>
              <ArrowLeft className="h-4 w-4 rotate-180" aria-hidden="true" />
              הרשמה
            </>
          )}
        </button>
      </form>

      <p className="text-center text-sm text-stone-500 mt-6">
        יש לכם כבר חשבון?{" "}
        <Link
          href="/login"
          className="text-brand-600 font-semibold hover:text-brand-700 transition-colors"
        >
          כניסה
        </Link>
      </p>
    </div>
  );
}
