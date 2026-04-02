import { z } from "zod";

// ── Phone helpers ─────────────────────────────────────────────────────────────

/** Israeli mobile number: 05X-XXXXXXX (10 digits, starts with 05) */
const israeliPhone = z
  .string()
  .regex(/^05\d{8}$/, "מספר טלפון לא תקין (לדוגמה: 0501234567)");

// ── Legacy OTP schemas — preserved for future phone OTP restoration ───────────

/** Phone-OTP login — preserved for future restoration */
export const phoneOtpSchema = z.object({
  phone: israeliPhone,
});

/** OTP verification code — preserved for future restoration */
export const otpVerifySchema = z.object({
  token: z
    .string()
    .length(6, "קוד האימות חייב להכיל 6 ספרות")
    .regex(/^\d{6}$/, "קוד האימות חייב להכיל ספרות בלבד"),
});

/**
 * Registration schema (legacy OTP version) — preserved for future restoration.
 * @deprecated Use emailPasswordRegisterSchema instead.
 */
export const registerSchema = z.object({
  full_name: z.string().min(2, "נא להזין שם מלא").max(100),
  phone: israeliPhone,
  email: z.string().email("כתובת אימייל לא תקינה"),
});

// ── Active schemas: email + password (temporary until phone OTP is set up) ────

/**
 * Email + password login.
 * TODO: Replace with phoneOtpSchema when SMS provider is connected.
 */
export const emailPasswordLoginSchema = z.object({
  email: z.string().email("כתובת אימייל לא תקינה"),
  password: z.string().min(6, "הסיסמה חייבת להכיל לפחות 6 תווים"),
});

/**
 * Email + password registration.
 * TODO: Replace with registerSchema + OTP when SMS provider is connected.
 */
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
export type OtpVerifyFormData = z.infer<typeof otpVerifySchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type EmailOtpFormData = z.infer<typeof emailOtpSchema>;
export type EmailPasswordLoginFormData = z.infer<typeof emailPasswordLoginSchema>;
export type EmailPasswordRegisterFormData = z.infer<typeof emailPasswordRegisterSchema>;
