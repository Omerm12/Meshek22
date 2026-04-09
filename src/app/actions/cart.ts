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
  image_color: string | null;
  product_icon: string | null;
};

function rowToItem(row: CartRow): CartLineItem {
  return {
    variantId:    row.variant_id,
    productId:    row.product_id,
    productName:  row.product_name,
    variantLabel: row.variant_label,
    priceAgorot:  row.price_agorot,
    quantity:     row.quantity,
    imageColor:   row.image_color  ?? undefined,
    productIcon:  row.product_icon ?? undefined,
  };
}

/**
 * Validate the current user's JWT against Supabase Auth and return the verified user ID.
 *
 * Two-step approach — satisfies both security and production reliability:
 *
 * 1. getSession() reads the access_token from the cookie (no network call, no timeout risk).
 * 2. createAdminClient().auth.getUser(token) validates the token with Supabase Auth
 *    server-side. The admin client is plain @supabase/supabase-js (no @supabase/ssr
 *    AbortSignal.timeout wrapper), so it is safe in production.
 *
 * This is stronger than getSession() alone because it catches revoked sessions.
 * It avoids the TimeoutError that the @supabase/ssr createServerClient's getUser()
 * triggers when the SSR auth interceptor attempts a token refresh.
 */
async function getVerifiedUserId(): Promise<string | null> {
  // Step 1: read the access token from the cookie — no network call
  const ssrClient = await createClient();
  const { data: { session } } = await ssrClient.auth.getSession();
  if (!session?.access_token) return null;

  // Step 2: validate the access token with Supabase Auth via the admin client.
  // Passing the JWT explicitly validates it server-side (checks signature + revocation).
  const admin = createAdminClient();
  const { data: { user }, error } = await admin.auth.getUser(session.access_token);
  if (error || !user) return null;

  return user.id;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Load the authenticated user's cart from the DB.
 * User identity is verified server-side via getVerifiedUserId() before any DB access.
 */
export async function dbLoadCart(): Promise<CartLineItem[]> {
  const userId = await getVerifiedUserId();
  if (!userId) return [];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_cart_items")
    .select(
      "variant_id,product_id,product_name,variant_label,price_agorot,quantity,image_color,product_icon"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data.map((row) => rowToItem(row as CartRow));
}

/**
 * Upsert a single cart item. Conflict target is (user_id, variant_id).
 * user_id comes from the server-validated JWT — never from the caller.
 */
export async function dbUpsertCartItem(item: CartLineItem): Promise<void> {
  const userId = await getVerifiedUserId();
  if (!userId) return;

  const admin = createAdminClient();
  await admin.from("user_cart_items").upsert(
    {
      user_id:       userId,
      variant_id:    item.variantId,
      product_id:    item.productId,
      product_name:  item.productName,
      variant_label: item.variantLabel,
      price_agorot:  item.priceAgorot,
      quantity:      item.quantity,
      image_color:   item.imageColor  ?? null,
      product_icon:  item.productIcon ?? null,
      updated_at:    new Date().toISOString(),
    },
    { onConflict: "user_id,variant_id" }
  );
}

/**
 * Remove a single variant from the authenticated user's cart.
 */
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

/**
 * Delete all cart items for the authenticated user.
 * Called by CartProvider on clearCart() and by createOrder after successful order.
 */
export async function dbClearCart(): Promise<void> {
  const userId = await getVerifiedUserId();
  if (!userId) return;

  const admin = createAdminClient();
  await admin
    .from("user_cart_items")
    .delete()
    .eq("user_id", userId);
}
