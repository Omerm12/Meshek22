import { z } from "zod";

export const categorySchema = z.object({
  name: z
    .string()
    .min(1, "נא להזין שם קטגוריה")
    .max(80, "שם הקטגוריה ארוך מדי"),
  slug: z
    .string()
    .min(1, "נא להזין slug")
    .max(80, "ה-slug ארוך מדי")
    .regex(
      /^[a-z0-9\u0590-\u05FF][a-z0-9\u0590-\u05FF-]*[a-z0-9\u0590-\u05FF]$|^[a-z0-9\u0590-\u05FF]$/,
      "ה-slug יכול להכיל אותיות, ספרות ומקפים בלבד, ולא להתחיל/להסתיים במקף"
    ),
  description: z.string().max(500, "התיאור ארוך מדי").optional().or(z.literal("")),
  image_url: z
    .string()
    .max(500)
    .optional()
    .or(z.literal(""))
    .refine(
      (val) => !val || /^https?:\/\//.test(val),
      "כתובת ה-URL חייבת להתחיל ב-http:// או https://"
    ),
  sort_order: z
    .number({ message: "נא להזין מספר" })
    .int("נא להזין מספר שלם")
    .min(0, "סדר המיון חייב להיות 0 או יותר")
    .max(9999),
  is_active: z.boolean(),
});

export type CategoryFormData = z.infer<typeof categorySchema>;
