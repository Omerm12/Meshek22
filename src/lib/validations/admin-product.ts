import { z } from "zod";

export const VARIANT_UNITS = ["unit", "250g", "500g", "1kg", "2kg", "bunch", "pack"] as const;
export type VariantUnit = (typeof VARIANT_UNITS)[number];

export const VARIANT_UNIT_LABELS: Record<VariantUnit, string> = {
  unit:   "יחידה",
  "250g": "250 גרם",
  "500g": "500 גרם",
  "1kg":  '1 ק"ג',
  "2kg":  '2 ק"ג',
  bunch:  "צרור",
  pack:   "מארז",
};

export const variantFormSchema = z
  .object({
    id:                    z.string().uuid().optional(),
    unit:                  z.enum(VARIANT_UNITS, { message: "נא לבחור יחידה" }),
    label:                 z.string().min(1, "נא להזין תווית").max(60, "התווית ארוכה מדי"),
    price:                 z.number({ message: "נא להזין מחיר" }).positive("המחיר חייב להיות חיובי"),
    compare_price:         z.number().positive("המחיר המקורי חייב להיות חיובי").nullable().optional(),
    stock_quantity:        z
      .number()
      .int("כמות חייבת להיות מספר שלם")
      .nonnegative("כמות לא יכולה להיות שלילית")
      .nullable()
      .optional(),
    // ── Fractional-quantity pricing ──────────────────────────────────────────
    // For unit='1kg': automatically set to 'per_kg' (enforced by the refinement below).
    // For all other units: always 'fixed'.
    quantity_pricing_mode: z.enum(["fixed", "per_kg"]),
    // How much qty changes per tap of +/−. Only meaningful when mode='per_kg'.
    quantity_step:         z
      .number()
      .positive('גודל צעד חייב להיות חיובי')
      .max(99, 'גודל צעד מקסימלי הוא 99'),
    // Minimum purchasable quantity (first add initialises cart to this value).
    min_quantity:          z
      .number()
      .positive('כמות מינימלית חייבת להיות חיובית')
      .max(99, 'כמות מינימלית מקסימלית היא 99'),
    // ────────────────────────────────────────────────────────────────────────
    is_available:          z.boolean(),
    is_default:            z.boolean(),
    sort_order:            z.number().int().min(0).max(9999),
  })
  .refine(
    (v) => v.compare_price == null || v.compare_price > v.price,
    { message: "מחיר מקורי חייב להיות גבוה ממחיר המכירה", path: ["compare_price"] }
  )
  .refine(
    (v) => v.unit !== "1kg" || v.quantity_pricing_mode === "per_kg",
    { message: 'גרסאות ק"ג חייבות להיות במצב תמחור לק"ג', path: ["quantity_pricing_mode"] }
  )
  .refine(
    (v) => v.unit !== "1kg" || v.quantity_step > 0,
    { message: 'גודל הצעד חייב להיות גדול מ-0', path: ["quantity_step"] }
  )
  .refine(
    (v) => v.unit !== "1kg" || v.min_quantity >= v.quantity_step,
    { message: 'כמות מינימלית חייבת להיות לפחות כגודל הצעד', path: ["min_quantity"] }
  );

export const productFormSchema = z.object({
  category_id: z.string().min(1, "נא לבחור קטגוריה"),
  name:        z.string().min(1, "נא להזין שם מוצר").max(120, "שם המוצר ארוך מדי"),
  slug:        z
    .string()
    .min(1, "נא להזין slug")
    .max(120, "ה-slug ארוך מדי")
    .regex(
      /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/,
      "ה-slug יכול להכיל אותיות קטנות, ספרות ומקפים בלבד"
    ),
  description: z.string().max(1000, "התיאור ארוך מדי").optional().or(z.literal("")),
  image_url:   z
    .string()
    .max(500)
    .optional()
    .or(z.literal(""))
    .refine(
      (val) => !val || /^https?:\/\//.test(val),
      "כתובת ה-URL חייבת להתחיל ב-http:// או https://"
    ),
  is_active:   z.boolean(),
  is_featured: z.boolean(),
  sort_order:  z.number().int().min(0).max(9999),
  // ── Bundle deal ────────────────────────────────────────────────────────────
  qty_deal_enabled:  z.boolean(),
  qty_deal_quantity: z.number().int().positive("כמות חייבת להיות חיובית").max(99).nullable().optional(),
  qty_deal_price:    z.number().positive("מחיר חייב להיות חיובי").nullable().optional(),
  // ──────────────────────────────────────────────────────────────────────────
  variants:    z
    .array(variantFormSchema)
    .min(1, "נדרשת לפחות גרסה אחת")
    .refine(
      (vs) => vs.filter((v) => v.is_default).length === 1,
      { message: "בדיוק גרסה אחת חייבת להיות ברירת המחדל" }
    ),
}).refine(
  (p) => !p.qty_deal_enabled || (p.qty_deal_quantity != null && p.qty_deal_price != null),
  { message: "כאשר המבצע מופעל יש להזין כמות ומחיר", path: ["qty_deal_quantity"] }
);

export type VariantFormData = z.infer<typeof variantFormSchema>;
export type ProductFormData  = z.infer<typeof productFormSchema>;
