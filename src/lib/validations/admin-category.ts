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
  /** Show this category in the homepage "קטגוריות מובילות" section. */
  is_featured: z.boolean(),
  /**
   * Show this category in the top navbar. Independent of is_active: an
   * inactive category never appears in the navbar regardless of this flag,
   * but an active category with this off remains reachable via its parent
   * page / direct URL — it's just absent from the menu.
   */
  show_in_navbar: z.boolean(),
  /**
   * Promotes a CHILD category to ALSO appear as its own top-level nav
   * heading, alongside remaining in its parent's submenu. Independent of
   * show_in_navbar — either can be on without the other.
   */
  show_as_top_level_nav: z.boolean(),
  /** UUID of the parent category. Empty string treated as null (no parent). */
  parent_id: z.string().uuid("מזהה קטגוריית אב אינו תקין").optional().or(z.literal("")),
});

export type CategoryFormData = z.infer<typeof categorySchema>;
