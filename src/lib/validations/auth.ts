import { z } from "zod";

// ── Phone helpers ─────────────────────────────────────────────────────────────

/** Israeli mobile number: 05X-XXXXXXX (10 digits, starts with 05) */
const israeliPhone = z
  .string()
  .regex(/^05\d{8}$/, "מספר טלפון לא תקין (לדוגמה: 0501234567)");

// ── Active schemas: phone OTP auth ────────────────────────────────────────────

/** Step 1 — phone input for OTP send (login flow) */
export const phoneOtpSchema = z.object({
  phone: israeliPhone,
});

/**
 * Registration info step — phone + name + email collected BEFORE OTP is sent.
 * Ensures name and email are available to write to the profile immediately after
 * OTP verification, so there is never a partial-auth / ghost-auth state.
 */
export const registerInfoSchema = z.object({
  phone: israeliPhone,
  full_name: z.string().min(2, "נא להזין שם מלא").max(100),
  email: z.string().email("כתובת אימייל לא תקינה"),
});

/** Step 2 — SMS OTP code verification (6 digits) */
export const otpVerifySchema = z.object({
  token: z
    .string()
    .length(6, "קוד האימות חייב להכיל 6 ספרות")
    .regex(/^\d{6}$/, "קוד האימות חייב להכיל ספרות בלבד"),
});

/**
 * Email OTP code verification (8 digits).
 * Supabase Auth is currently configured to issue 8-digit email OTP codes.
 * SMS OTP remains 6 digits and uses otpVerifySchema above.
 */
export const emailOtpVerifySchema = z.object({
  token: z
    .string()
    .length(8, "קוד האימות חייב להכיל 8 ספרות")
    .regex(/^\d{8}$/, "קוד האימות חייב להכיל ספרות בלבד"),
});

/**
 * Step 3 (new users only) — profile completion after OTP.
 * Phone is already captured and verified via OTP — not collected here.
 * Both full_name and email are required for new users.
 */
export const profileSchema = z.object({
  full_name: z.string().min(2, "נא להזין שם מלא").max(100),
  email: z.string().email("כתובת אימייל לא תקינה"),
});

// ── Legacy schemas (kept for reference / possible admin use) ──────────────────

/** @deprecated Use phoneOtpSchema instead */
export const registerSchema = z.object({
  full_name: z.string().min(2, "נא להזין שם מלא").max(100),
  phone: israeliPhone,
  email: z.string().email("כתובת אימייל לא תקינה"),
});

/** @deprecated Temporary password-based login schema */
export const emailPasswordLoginSchema = z.object({
  email: z.string().email("כתובת אימייל לא תקינה"),
  password: z.string().min(6, "הסיסמה חייבת להכיל לפחות 6 תווים"),
});

/** @deprecated Temporary password-based registration schema */
export const emailPasswordRegisterSchema = z
  .object({
    full_name: z.string().min(2, "נא להזין שם מלא").max(100),
    email: z.string().email("כתובת אימייל לא תקינה"),
    phone: israeliPhone,
    password: z.string().min(6, "הסיסמה חייבת להכיל לפחות 6 תווים"),
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "הסיסמאות אינן תואמות",
    path: ["confirm_password"],
  });

// Kept for any legacy email-magic-link paths
export const emailOtpSchema = z.object({
  email: z.string().email("כתובת אימייל לא תקינה"),
});

// ── Inferred types ────────────────────────────────────────────────────────────

export type PhoneOtpFormData = z.infer<typeof phoneOtpSchema>;
export type RegisterInfoFormData = z.infer<typeof registerInfoSchema>;
export type OtpVerifyFormData = z.infer<typeof otpVerifySchema>;
export type EmailOtpVerifyFormData = z.infer<typeof emailOtpVerifySchema>;
export type ProfileFormData = z.infer<typeof profileSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type EmailOtpFormData = z.infer<typeof emailOtpSchema>;
export type EmailPasswordLoginFormData = z.infer<typeof emailPasswordLoginSchema>;
export type EmailPasswordRegisterFormData = z.infer<typeof emailPasswordRegisterSchema>;
