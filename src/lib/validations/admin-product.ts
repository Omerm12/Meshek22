import { z } from "zod";

export const VARIANT_UNITS = ["unit", "250g", "500g", "1kg", "2kg", "bunch", "pack"] as const;
export type VariantUnit = (typeof VARIANT_UNITS)[number];

export const VARIANT_UNIT_LABELS: Record<VariantUnit, string> = {
  unit:  "יחידה",
  "250g": "250 גרם",
  "500g": "500 גרם",
  "1kg":  '1 ק"ג',
  "2kg":  '2 ק"ג',
  bunch: "צרור",
  pack:  "מארז",
};

export const variantFormSchema = z
  .object({
    id:                   z.string().uuid().optional(),
    unit:                 z.enum(VARIANT_UNITS, { message: "נא לבחור יחידה" }),
    label:                z.string().min(1, "נא להזין תווית").max(60, "התווית ארוכה מדי"),
    price:                z.number({ message: "נא להזין מחיר" }).positive("המחיר חייב להיות חיובי"),
    compare_price:        z.number().positive("המחיר המקורי חייב להיות חיובי").nullable().optional(),
    stock_quantity:       z
      .number()
      .int("כמות חייבת להיות מספר שלם")
      .nonnegative("כמות לא יכולה להיות שלילית")
      .nullable()
      .optional(),
    is_available:         z.boolean(),
    is_default:           z.boolean(),
    sort_order:           z.number().int().min(0).max(9999),
  })
  .refine(
    (v) => v.compare_price == null || v.compare_price > v.price,
    { message: "מחיר מקורי חייב להיות גבוה ממחיר המכירה", path: ["compare_price"] }
  );

export const productFormSchema = z.object({
  category_id:  z.string().min(1, "נא לבחור קטגוריה"),
  name:         z.string().min(1, "נא להזין שם מוצר").max(120, "שם המוצר ארוך מדי"),
  slug:         z
    .string()
    .min(1, "נא להזין slug")
    .max(120, "ה-slug ארוך מדי")
    .regex(
      /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/,
      "ה-slug יכול להכיל אותיות קטנות, ספרות ומקפים בלבד"
    ),
  description:  z.string().max(1000, "התיאור ארוך מדי").optional().or(z.literal("")),
  image_url:    z
    .string()
    .max(500)
    .optional()
    .or(z.literal(""))
    .refine(
      (val) => !val || /^https?:\/\//.test(val),
      "כתובת ה-URL חייבת להתחיל ב-http:// או https://"
    ),
  is_active:    z.boolean(),
  is_featured:  z.boolean(),
  sort_order:   z.number().int().min(0).max(9999),
  variants:     z
    .array(variantFormSchema)
    .min(1, "נדרשת לפחות גרסה אחת")
    .refine(
      (vs) => vs.filter((v) => v.is_default).length === 1,
      { message: "בדיוק גרסה אחת חייבת להיות ברירת המחדל" }
    ),
});

export type VariantFormData = z.infer<typeof variantFormSchema>;
export type ProductFormData  = z.infer<typeof productFormSchema>;
