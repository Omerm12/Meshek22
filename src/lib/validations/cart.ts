import { z } from "zod";

export const addToCartSchema = z.object({
  product_variant_id: z.string().uuid("מזהה מוצר לא תקין"),
  quantity: z.number().int().min(1, "כמות מינימלית היא 1").max(99),
});

export const updateCartItemSchema = z.object({
  cart_item_id: z.string().uuid(),
  quantity: z.number().int().min(0).max(99),
});

export type AddToCartData = z.infer<typeof addToCartSchema>;
export type UpdateCartItemData = z.infer<typeof updateCartItemSchema>;
