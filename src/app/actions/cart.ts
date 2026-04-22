"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import type { CartLineItem } from "@/store/cart";

// ─── Row type returned from Supabase select ───────────────────────────────────

type CartRow = {
  variant_id: string;
  product_id: string;
  product_name: string;
  variant_label: string;
  price_agorot: number;
  quantity: number;
  quantity_pricing_mode: "per_kg" | "fixed";
  quantity_step: number;
  min_quantity: number;
  deal_enabled: boolean;
  deal_quantity: number | null;
  deal_price_agorot: number | null;
  image_url: string | null;
  image_color: string | null;
  product_icon: string | null;
};

function rowToItem(row: CartRow): CartLineItem {
  return {
    variantId:           row.variant_id,
    productId:           row.product_id,
    productName:         row.product_name,
    variantLabel:        row.variant_label,
    priceAgorot:         row.price_agorot,
    quantity:            row.quantity,
    quantityPricingMode: row.quantity_pricing_mode ?? "fixed",
    quantityStep:        row.quantity_step ?? 1,
    minQuantity:         row.min_quantity  ?? 1,
    dealEnabled:         row.deal_enabled      ?? false,
    dealQuantity:        row.deal_quantity      ?? null,
    dealPriceAgorot:     row.deal_price_agorot  ?? null,
    imageUrl:            row.image_url    ?? null,
    imageColor:          row.image_color  ?? undefined,
    productIcon:         row.product_icon ?? undefined,
  };
}

/**
 * Validate the current user's JWT against Supabase Auth and return the verified user ID.
 */
async function getVerifiedUserId(): Promise<string | null> {
  const ssrClient = await createClient();
  const { data: { session } } = await ssrClient.auth.getSession();
  if (!session?.access_token) return null;

  const admin = createAdminClient();
  const { data: { user }, error } = await admin.auth.getUser(session.access_token);
  if (error || !user) return null;

  return user.id;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function dbLoadCart(): Promise<CartLineItem[]> {
  const userId = await getVerifiedUserId();
  if (!userId) return [];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_cart_items")
    .select(
      "variant_id,product_id,product_name,variant_label,price_agorot,quantity," +
      "quantity_pricing_mode,quantity_step,min_quantity," +
      "deal_enabled,deal_quantity,deal_price_agorot," +
      "image_url,image_color,product_icon"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data.map((row) => rowToItem(row as unknown as CartRow));
}

export async function dbUpsertCartItem(item: CartLineItem): Promise<void> {
  const userId = await getVerifiedUserId();
  if (!userId) return;

  const admin = createAdminClient();
  await admin.from("user_cart_items").upsert(
    {
      user_id:               userId,
      variant_id:            item.variantId,
      product_id:            item.productId,
      product_name:          item.productName,
      variant_label:         item.variantLabel,
      price_agorot:          item.priceAgorot,
      quantity:              item.quantity,
      quantity_pricing_mode: item.quantityPricingMode ?? "fixed",
      quantity_step:         item.quantityStep ?? 1,
      min_quantity:          item.minQuantity  ?? 1,
      deal_enabled:          item.dealEnabled      ?? false,
      deal_quantity:         item.dealQuantity      ?? null,
      deal_price_agorot:     item.dealPriceAgorot   ?? null,
      image_url:             item.imageUrl    ?? null,
      image_color:           item.imageColor  ?? null,
      product_icon:          item.productIcon ?? null,
      updated_at:            new Date().toISOString(),
    },
    { onConflict: "user_id,variant_id" }
  );
}

export async function dbRemoveCartItem(variantId: string): Promise<void> {
  const userId = await getVerifiedUserId();
  if (!userId) return;

  const admin = createAdminClient();
  await admin
    .from("user_cart_items")
    .delete()
    .eq("user_id", userId)
    .eq("variant_id", variantId);
}

export async function dbClearCart(): Promise<void> {
  const userId = await getVerifiedUserId();
  if (!userId) return;

  const admin = createAdminClient();
  await admin
    .from("user_cart_items")
    .delete()
    .eq("user_id", userId);
}
