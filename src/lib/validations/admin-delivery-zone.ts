import { z } from "zod";

// Monetary values are entered by the admin in ₪ (shekel, float),
// then multiplied × 100 to store as integer agorot.

export const DELIVERY_DAYS_OPTIONS = [
  "ראשון",
  "שני",
  "שלישי",
  "רביעי",
  "חמישי",
  "שישי",
  "שבת",
] as const;

export const deliveryZoneSchema = z.object({
  name: z
    .string()
    .min(1, "נא להזין שם אזור משלוח")
    .max(100, "שם האזור ארוך מדי (עד 100 תווים)"),
  slug: z
    .string()
    .min(1, "נא להזין slug")
    .max(80, "ה-slug ארוך מדי (עד 80 תווים)")
    .regex(
      /^[a-z0-9\u0590-\u05FF][a-z0-9\u0590-\u05FF-]*[a-z0-9\u0590-\u05FF]$|^[a-z0-9\u0590-\u05FF]$/,
      "ה-slug יכול להכיל אותיות לועזיות/עבריות, ספרות ומקפים בלבד, ולא להתחיל/להסתיים במקף"
    ),
  description: z
    .string()
    .max(500, "התיאור ארוך מדי (עד 500 תווים)")
    .optional()
    .or(z.literal("")),
  // Monetary fields in ₪ (float). Stored as agorot (integer) in DB.
  delivery_fee_shekel: z
    .number({ message: "נא להזין מספר" })
    .min(0, "דמי המשלוח לא יכולים להיות שליליים")
    .max(9999.99, "דמי המשלוח גבוהים מדי"),
  min_order_shekel: z
    .number({ message: "נא להזין מספר" })
    .min(0, "מינימום הזמנה לא יכול להיות שלילי")
    .max(99999.99, "מינימום הזמנה גבוה מדי")
    .nullable()
    .optional(),
  free_delivery_threshold_shekel: z
    .number({ message: "נא להזין מספר" })
    .min(0.01, "סף משלוח חינם חייב להיות גדול מ-₪0")
    .max(99999.99, "ערך גבוה מדי")
    .nullable()
    .optional(),
  delivery_days: z
    .array(z.string())
    .min(1, "נא לבחור לפחות יום משלוח אחד"),
  estimated_delivery_hours: z
    .number({ message: "נא להזין מספר" })
    .int("נא להזין מספר שלם")
    .min(1, "זמן אספקה חייב להיות לפחות שעה אחת")
    .max(720, "זמן אספקה לא יכול לעלות על 720 שעות")
    .nullable()
    .optional(),
  is_active: z.boolean(),
  sort_order: z
    .number({ message: "נא להזין מספר" })
    .int("נא להזין מספר שלם")
    .min(0, "סדר מיון חייב להיות 0 או יותר")
    .max(9999, "סדר מיון חייב להיות עד 9999"),
});

export type DeliveryZoneFormData = z.infer<typeof deliveryZoneSchema>;
