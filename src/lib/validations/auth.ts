import { z } from "zod";

// Magic-link / OTP login — email only
export const emailOtpSchema = z.object({
  email: z.string().email("כתובת אימייל לא תקינה"),
});

export const loginSchema = z.object({
  email: z.string().email("כתובת אימייל לא תקינה"),
  password: z.string().min(6, "סיסמה חייבת להכיל לפחות 6 תווים"),
});

export const registerSchema = z
  .object({
    full_name: z.string().min(2, "נא להזין שם מלא").max(100),
    email: z.string().email("כתובת אימייל לא תקינה"),
    phone: z
      .string()
      .regex(/^0\d{8,9}$/, "מספר טלפון לא תקין (לדוגמה: 0501234567)")
      .optional()
      .or(z.literal("")),
    password: z.string().min(8, "סיסמה חייבת להכיל לפחות 8 תווים"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "הסיסמאות אינן תואמות",
    path: ["confirmPassword"],
  });

export const resetPasswordSchema = z.object({
  email: z.string().email("כתובת אימייל לא תקינה"),
});

export const updatePasswordSchema = z
  .object({
    password: z.string().min(8, "סיסמה חייבת להכיל לפחות 8 תווים"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "הסיסמאות אינן תואמות",
    path: ["confirmPassword"],
  });

export type EmailOtpFormData = z.infer<typeof emailOtpSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
export type UpdatePasswordFormData = z.infer<typeof updatePasswordSchema>;
