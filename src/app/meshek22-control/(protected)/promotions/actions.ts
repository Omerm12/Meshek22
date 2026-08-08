"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { revalidateStorefront } from "@/lib/admin/revalidate";
import { promotionSchema } from "@/lib/validations/admin-promotion";

export type ActionResult = { success: true } | { success: false; error: string };

/**
 * Every action re-checks authorization with requireAdmin(). The protected layout
 * already guards the pages, but a Server Action is a plain HTTP endpoint that can
 * be invoked without any layout rendering — so it must never rely on its caller.
 * requireAdmin() is memoised per request, so this costs nothing when a page in
 * the same request already resolved it.
 */

function parseForm(formData: FormData) {
  const rawVariantIds = (formData.get("variant_ids") as string | null) ?? "[]";
  let variantIds: unknown = [];
  try {
    variantIds = JSON.parse(rawVariantIds);
  } catch {
    variantIds = [];
  }

  // The form collects shekels; the database stores agorot.
  const priceShekels = Number(formData.get("bundle_price_shekels"));

  return promotionSchema.safeParse({
    name:                formData.get("name"),
    description:         formData.get("description") ?? "",
    required_quantity:   Number(formData.get("required_quantity")),
    bundle_price_agorot: Number.isFinite(priceShekels) ? Math.round(priceShekels * 100) : NaN,
    is_active:           formData.get("is_active") === "true",
    starts_at:           formData.get("starts_at") ?? "",
    ends_at:             formData.get("ends_at") ?? "",
    sort_order:          Number(formData.get("sort_order") ?? 0),
    variant_ids:         variantIds,
  });
}

/**
 * Reject variants the "N for ₪X" rule is not defined for.
 *
 * A per_kg variant is priced by weight, so "any 4 of these for ₪10" has no
 * meaning for it. The database refuses these too (promotion_items_guard), but
 * catching it here lets the shop owner see a clear Hebrew message naming the
 * offending product instead of a Postgres error.
 */
async function rejectPerKgVariants(
  db: ReturnType<typeof createAdminClient>,
  variantIds: string[]
): Promise<string | null> {
  const { data } = await db
    .from("product_variants")
    .select("id, label, quantity_pricing_mode, products(name)")
    .in("id", variantIds)
    .eq("quantity_pricing_mode", "per_kg");

  if (!data || data.length === 0) return null;

  const names = data
    .map((v) => {
      const product = v.products as unknown as { name?: string } | null;
      return `${product?.name ?? "מוצר"} (${v.label})`;
    })
    .slice(0, 5)
    .join(", ");

  return `לא ניתן לכלול מוצרים הנמכרים לפי משקל במבצע כמות: ${names}. בחרו וריאציות הנמכרות ביחידות.`;
}

/** Map a database guard violation onto a message the shop owner can act on. */
function translateDbError(message: string | undefined): string {
  if (!message) return "שגיאה בשמירת המבצע. נסו שוב.";
  if (message.includes("per_kg")) {
    return "לא ניתן לכלול מוצרים הנמכרים לפי משקל במבצע כמות.";
  }
  if (message.includes("overlapping active promotion") || message.includes("would overlap")) {
    return "אחד המוצרים שנבחרו כבר משתתף במבצע פעיל אחר באותו טווח תאריכים. הסירו אותו או כבו את המבצע הקודם.";
  }
  return "שגיאה בשמירת המבצע. נסו שוב.";
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createPromotion(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  }

  const db = createAdminClient();

  const perKgError = await rejectPerKgVariants(db, parsed.data.variant_ids);
  if (perKgError) return { success: false, error: perKgError };

  const { data: promotion, error } = await db
    .from("promotions")
    .insert({
      name:                parsed.data.name,
      description:         parsed.data.description,
      required_quantity:   parsed.data.required_quantity,
      bundle_price_agorot: parsed.data.bundle_price_agorot,
      is_active:           parsed.data.is_active,
      starts_at:           parsed.data.starts_at,
      ends_at:             parsed.data.ends_at,
      sort_order:          parsed.data.sort_order,
    })
    .select("id")
    .single();

  if (error || !promotion) {
    return { success: false, error: translateDbError(error?.message) };
  }

  const { error: itemsError } = await db.from("promotion_items").insert(
    parsed.data.variant_ids.map((variantId) => ({
      promotion_id:       promotion.id,
      product_variant_id: variantId,
    }))
  );

  if (itemsError) {
    // The promotion row would otherwise be left with no eligible products, which
    // is invalid — remove it so the owner can correct the selection and retry.
    await db.from("promotions").delete().eq("id", promotion.id);
    return { success: false, error: translateDbError(itemsError.message) };
  }

  revalidatePath(ADMIN_ROUTES.promotions);
  revalidateStorefront();

  redirect(ADMIN_ROUTES.promotions);
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updatePromotion(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  }

  const db = createAdminClient();

  const perKgError = await rejectPerKgVariants(db, parsed.data.variant_ids);
  if (perKgError) return { success: false, error: perKgError };

  const { error } = await db
    .from("promotions")
    .update({
      name:                parsed.data.name,
      description:         parsed.data.description,
      required_quantity:   parsed.data.required_quantity,
      bundle_price_agorot: parsed.data.bundle_price_agorot,
      is_active:           parsed.data.is_active,
      starts_at:           parsed.data.starts_at,
      ends_at:             parsed.data.ends_at,
      sort_order:          parsed.data.sort_order,
    })
    .eq("id", id);

  if (error) {
    return { success: false, error: translateDbError(error.message) };
  }

  // Replace the membership set. Removing first keeps the overlap guard happy
  // when variants are being moved between promotions.
  const { error: deleteError } = await db.from("promotion_items").delete().eq("promotion_id", id);
  if (deleteError) {
    return { success: false, error: "שגיאה בעדכון המוצרים במבצע. נסו שוב." };
  }

  const { error: itemsError } = await db.from("promotion_items").insert(
    parsed.data.variant_ids.map((variantId) => ({
      promotion_id:       id,
      product_variant_id: variantId,
    }))
  );

  if (itemsError) {
    return { success: false, error: translateDbError(itemsError.message) };
  }

  revalidatePath(ADMIN_ROUTES.promotions);
  revalidateStorefront();

  redirect(ADMIN_ROUTES.promotions);
}

// ── Enable / disable ──────────────────────────────────────────────────────────

export async function setPromotionActive(id: string, isActive: boolean): Promise<ActionResult> {
  await requireAdmin();

  const db = createAdminClient();
  const { error } = await db.from("promotions").update({ is_active: isActive }).eq("id", id);

  if (error) {
    return { success: false, error: translateDbError(error.message) };
  }

  revalidatePath(ADMIN_ROUTES.promotions);
  revalidateStorefront();
  return { success: true };
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deletePromotion(id: string): Promise<ActionResult> {
  await requireAdmin();

  const db = createAdminClient();
  // promotion_items rows go with it via ON DELETE CASCADE. Historical orders are
  // unaffected: order_items.promotion_id is intentionally not a foreign key, and
  // promotion_snapshot preserves the readable details.
  const { error } = await db.from("promotions").delete().eq("id", id);

  if (error) {
    return { success: false, error: "שגיאה במחיקת המבצע. נסו שוב." };
  }

  revalidatePath(ADMIN_ROUTES.promotions);
  revalidateStorefront();
  return { success: true };
}

// ── Product search for the promotion form ─────────────────────────────────────

export interface PromotionVariantOption {
  variantId: string;
  variantLabel: string;
  productId: string;
  productName: string;
  priceAgorot: number;
  /** per_kg variants cannot join a quantity promotion; shown disabled with a reason. */
  isPerKg: boolean;
}

/**
 * Search active products and return their variants, grouped visually by product
 * in the UI. Variant-level membership is what the database stores, so this keeps
 * the unit/kg distinction explicit rather than guessing on the owner's behalf.
 */
export async function searchPromotionVariants(query: string): Promise<PromotionVariantOption[]> {
  await requireAdmin();

  const trimmed = query.trim();
  const db = createAdminClient();

  let request = db
    .from("products")
    .select("id, name, product_variants(id, label, price_agorot, quantity_pricing_mode, is_available, sort_order)")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(40);

  if (trimmed.length > 0) {
    request = request.ilike("name", `%${trimmed}%`);
  }

  const { data, error } = await request;
  if (error || !data) return [];

  type Row = {
    id: string;
    name: string;
    product_variants: {
      id: string;
      label: string;
      price_agorot: number;
      quantity_pricing_mode: "fixed" | "per_kg";
      is_available: boolean;
      sort_order: number;
    }[];
  };

  return (data as unknown as Row[]).flatMap((product) =>
    [...product.product_variants]
      .filter((v) => v.is_available)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((variant) => ({
        variantId:    variant.id,
        variantLabel: variant.label,
        productId:    product.id,
        productName:  product.name,
        priceAgorot:  variant.price_agorot,
        isPerKg:      variant.quantity_pricing_mode === "per_kg",
      }))
  );
}
