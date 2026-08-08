import { z } from "zod";

/**
 * Administrator promotion form validation.
 *
 * The messages here are what the shop owner actually reads, so they are written
 * in plain Hebrew rather than as field names.
 */
export const promotionSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "נא להזין שם למבצע")
      .max(120, "שם המבצע ארוך מדי (עד 120 תווים)"),

    description: z
      .string()
      .trim()
      .max(300, "התיאור ארוך מדי (עד 300 תווים)")
      .optional()
      .transform((v) => (v ? v : null)),

    required_quantity: z
      .number({ message: "נא להזין כמות נדרשת" })
      .int("הכמות חייבת להיות מספר שלם")
      .min(2, "הכמות הנדרשת חייבת להיות לפחות 2")
      .max(100, "הכמות הנדרשת גבוהה מדי (עד 100)"),

    bundle_price_agorot: z
      .number({ message: "נא להזין מחיר למבצע" })
      .int("המחיר חייב להיות מספר שלם באגורות")
      .min(0, "המחיר לא יכול להיות שלילי")
      .max(10_000_000, "המחיר גבוה מדי"),

    is_active: z.boolean(),

    starts_at: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : null)),

    ends_at: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : null)),

    sort_order: z.number().int().min(0).max(9999),

    /** Eligible product variants. At least one is required. */
    variant_ids: z
      .array(z.string().uuid("מזהה וריאציה לא תקין"))
      .min(1, "נא לבחור לפחות מוצר אחד למבצע")
      .max(300, "נבחרו יותר מדי מוצרים למבצע אחד"),
  })
  .superRefine((data, ctx) => {
    if (data.starts_at && data.ends_at) {
      const start = Date.parse(data.starts_at);
      const end = Date.parse(data.ends_at);
      if (Number.isFinite(start) && Number.isFinite(end) && end <= start) {
        ctx.addIssue({
          code: "custom",
          path: ["ends_at"],
          message: "תאריך הסיום חייב להיות אחרי תאריך ההתחלה",
        });
      }
    }
  });

export type PromotionFormData = z.input<typeof promotionSchema>;
export type PromotionParsed = z.output<typeof promotionSchema>;
