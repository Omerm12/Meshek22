"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { revalidateStorefront } from "@/lib/admin/revalidate";
import { promotionSchema } from "@/lib/validations/admin-promotion";
import { completeMutation, completeUpdateMutation, logMutationTiming } from "@/lib/admin/instrumentation";

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
  const start = performance.now();
  await requireAdmin();

  const parsed = parseForm(formData);
  if (!parsed.success) {
    logMutationTiming("promotion-create", start, { outcome: "validation-error", stage: "validation_failed" });
    return { success: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  }

  const db = createAdminClient();

  const perKgError = await rejectPerKgVariants(db, parsed.data.variant_ids);
  if (perKgError) {
    logMutationTiming("promotion-create", start, { outcome: "rejected", stage: "validation_failed" });
    return { success: false, error: perKgError };
  }

  // One transaction: the promotion and its membership are written together, so a
  // rejected variant can no longer leave an active promotion with no products.
  const rpcStart = performance.now();
  const { error } = await db.rpc("save_promotion", {
    p_promotion_id:        null,
    p_name:                parsed.data.name,
    p_description:         parsed.data.description,
    p_required_quantity:   parsed.data.required_quantity,
    p_bundle_price_agorot: parsed.data.bundle_price_agorot,
    p_is_active:           parsed.data.is_active,
    p_starts_at:           parsed.data.starts_at,
    p_ends_at:             parsed.data.ends_at,
    p_sort_order:          parsed.data.sort_order,
    p_variant_ids:         parsed.data.variant_ids,
  });
  const rpcMs = Math.round(performance.now() - rpcStart);

  if (error) {
    logMutationTiming("promotion-create", start, { rpcMs, outcome: "error", stage: "write_failed" });
    return { success: false, error: translateDbError(error.message) };
  }

  completeMutation(
    "promotion-create",
    start,
    ADMIN_ROUTES.promotions,
    () => {
      revalidatePath(ADMIN_ROUTES.promotions);
      revalidateStorefront();
    },
    { rpcMs }
  );
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updatePromotion(id: string, formData: FormData): Promise<ActionResult> {
  const start = performance.now();
  const authStart = start;
  await requireAdmin();
  const authMs = Math.round(performance.now() - authStart);

  const parsed = parseForm(formData);
  if (!parsed.success) {
    logMutationTiming("promotion-update", start, { authMs, outcome: "validation-error", stage: "validation_failed" });
    return { success: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  }

  const db = createAdminClient();

  const perKgError = await rejectPerKgVariants(db, parsed.data.variant_ids);
  if (perKgError) {
    logMutationTiming("promotion-update", start, { authMs, outcome: "rejected", stage: "validation_failed" });
    return { success: false, error: perKgError };
  }

  // One transaction. The RPC deactivates the promotion, swaps its membership and
  // only then applies the requested dates and active flag, so the activation
  // guard judges the FINAL set — and any rejection rolls the whole edit back
  // instead of leaving the promotion with its products deleted.
  const rpcStart = performance.now();
  const { error } = await db.rpc("save_promotion", {
    p_promotion_id:        id,
    p_name:                parsed.data.name,
    p_description:         parsed.data.description,
    p_required_quantity:   parsed.data.required_quantity,
    p_bundle_price_agorot: parsed.data.bundle_price_agorot,
    p_is_active:           parsed.data.is_active,
    p_starts_at:           parsed.data.starts_at,
    p_ends_at:             parsed.data.ends_at,
    p_sort_order:          parsed.data.sort_order,
    p_variant_ids:         parsed.data.variant_ids,
  });
  const rpcMs = Math.round(performance.now() - rpcStart);

  if (error) {
    logMutationTiming("promotion-update", start, { authMs, rpcMs, outcome: "error", stage: "write_failed" });
    return { success: false, error: translateDbError(error.message) };
  }

  return completeUpdateMutation(
    "promotion-update",
    start,
    () => {
      revalidatePath(ADMIN_ROUTES.promotions);
      revalidateStorefront();
    },
    { authMs, rpcMs }
  );
}

// ── Enable / disable ──────────────────────────────────────────────────────────

export async function setPromotionActive(id: string, isActive: boolean): Promise<ActionResult> {
  const start = performance.now();
  await requireAdmin();

  const db = createAdminClient();
  const { error } = await db.from("promotions").update({ is_active: isActive }).eq("id", id);

  if (error) {
    logMutationTiming("promotion-toggle-active", start, { outcome: "error", stage: "write_failed" });
    return { success: false, error: translateDbError(error.message) };
  }

  revalidatePath(ADMIN_ROUTES.promotions);
  revalidateStorefront();
  logMutationTiming("promotion-toggle-active", start, { outcome: "success", stage: "write_succeeded" });
  return { success: true };
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deletePromotion(id: string): Promise<ActionResult> {
  const start = performance.now();
  await requireAdmin();

  const db = createAdminClient();
  // promotion_items rows go with it via ON DELETE CASCADE. Historical orders are
  // unaffected: order_items.promotion_id is intentionally not a foreign key, and
  // promotion_snapshot preserves the readable details.
  const { error } = await db.from("promotions").delete().eq("id", id);

  if (error) {
    logMutationTiming("promotion-delete", start, { outcome: "error", stage: "write_failed" });
    return { success: false, error: "שגיאה במחיקת המבצע. נסו שוב." };
  }

  revalidatePath(ADMIN_ROUTES.promotions);
  revalidateStorefront();
  logMutationTiming("promotion-delete", start, { outcome: "success", stage: "write_succeeded" });
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
  // A genuine query failure must not look like "no products match" — the shop
  // owner would otherwise conclude the product simply doesn't exist.
  if (error) {
    console.error("[admin:promotions] variant search failed", {
      code: error.code,
      message: error.message,
    });
    throw new Error("שגיאה בחיפוש מוצרים. נסו שוב.");
  }
  if (!data) return [];

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
