import { z } from "zod";

export const addToCartSchema = z.object({
  product_variant_id: z.string().uuid("מזהה מוצר לא תקין"),
  // Fractional quantities supported for kg-based variants (e.g. 0.5, 1.5).
  // Integer quantities (unit, pack, etc.) satisfy this constraint automatically.
  quantity: z.number().positive("כמות חייבת להיות חיובית").max(999),
});

export const updateCartItemSchema = z.object({
  cart_item_id: z.string().uuid(),
  quantity: z.number().min(0).max(999),
});

export type AddToCartData = z.infer<typeof addToCartSchema>;
export type UpdateCartItemData = z.infer<typeof updateCartItemSchema>;
