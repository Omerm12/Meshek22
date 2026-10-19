"use server";

import { revalidatePath } from "next/cache";
import { revalidateStorefront } from "@/lib/admin/revalidate";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { productFormSchema, type ProductFormData } from "@/lib/validations/admin-product";
import { ADMIN_BASE_PATH } from "@/lib/admin/routes";
import {
  completeDeleteMutation,
  completeMutation,
  completeUpdateMutation,
  logMutationTiming,
} from "@/lib/admin/instrumentation";

export type ActionResult = { success: true } | { success: false; error: string };
export type UpdateProductResult =
  | { success: true; variants: RpcVariant[] }
  | { success: false; error: string };

// ─── Image upload ─────────────────────────────────────────────────────────────

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES      = 5 * 1024 * 1024; // 5 MB
const STORAGE_BUCKET       = "product-images";

export type UploadResult = { url: string } | { error: string };

export async function uploadProductImage(formData: FormData): Promise<UploadResult> {
  await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "לא נבחר קובץ" };
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { error: "סוג קובץ לא נתמך. יש לבחור JPEG, PNG או WebP." };
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return { error: "הקובץ גדול מדי (מקסימום 5MB)" };
  }

  const ext      = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const filename = `products/${crypto.randomUUID()}.${ext}`;

  const supabase = createAdminClient();
  const bytes    = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filename, bytes, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("[uploadProductImage]", uploadError.message);
    return { error: "שגיאה בהעלאת הקובץ. נסו שוב." };
  }

  const { data: { publicUrl } } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filename);

  return { url: publicUrl };
}

// ─── Variant → RPC payload ──────────────────────────────────────────────────

export interface RpcVariant {
  id: string;
  unit: string;
  label: string;
  price_agorot: number;
  compare_price_agorot: number | null;
  stock_quantity: number | null;
  quantity_pricing_mode: string;
  quantity_step: number;
  min_quantity: number;
  is_available: boolean;
  is_default: boolean;
  sort_order: number;
}

/**
 * Builds the JSON object admin_save_product_with_variants
 * (20260923000000_admin_product_variants_rpc.sql) expects per variant. The
 * `id` key must be OMITTED — not set to null — for a new variant: the RPC
 * tests key presence (`elem ? 'id'`) to tell "new" from "existing", the same
 * convention this function used before the RPC existed.
 */
function toRpcVariant(v: ProductFormData["variants"][number]) {
  return {
    ...(v.id ? { id: v.id } : {}),
    unit:                  v.unit,
    label:                 v.label,
    price_agorot:          Math.round(v.price * 100),
    compare_price_agorot:  v.compare_price != null ? Math.round(v.compare_price * 100) : null,
    stock_quantity:        v.stock_quantity ?? null,
    quantity_pricing_mode: v.quantity_pricing_mode,
    quantity_step:         v.quantity_step,
    min_quantity:          v.min_quantity,
    is_available:          v.is_available,
    is_default:            v.is_default,
    sort_order:            v.sort_order,
  };
}

function parseFormData(formData: FormData): ProductFormData | null {
  const raw = formData.get("data");
  if (!raw || typeof raw !== "string") return null;
  try {
    return productFormSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createProduct(formData: FormData): Promise<ActionResult> {
  const start = performance.now();
  await requireAdmin();

  const parsed = parseFormData(formData);
  if (!parsed) {
    logMutationTiming("product-create", start, { outcome: "validation-error", stage: "validation_failed" });
    return { success: false, error: "אימות נתונים נכשל. בדקו את הטופס." };
  }

  const supabase = await createAdminClient();
  const { variants, qty_deal_price, ...productFields } = parsed;

  // One round trip, one transaction: product row + every variant write.
  // A rejected variant (e.g. a duplicate default) rolls the product insert
  // back too — see 20260923000000_admin_product_variants_rpc.sql.
  const rpcStart = performance.now();
  const { error } = await supabase.rpc("admin_save_product_with_variants", {
    p_product_id: null,
    p_category_id: productFields.category_id,
    p_name: productFields.name,
    p_slug: productFields.slug,
    p_description: productFields.description ?? "",
    p_image_url: productFields.image_url ?? "",
    p_is_active: productFields.is_active,
    p_is_featured: productFields.is_featured,
    p_sort_order: productFields.sort_order,
    p_qty_deal_enabled: productFields.qty_deal_enabled,
    p_qty_deal_quantity: productFields.qty_deal_enabled ? (productFields.qty_deal_quantity ?? null) : null,
    p_qty_deal_price_agorot: productFields.qty_deal_enabled && qty_deal_price != null
      ? Math.round(qty_deal_price * 100)
      : null,
    p_variants: variants.map(toRpcVariant),
  });
  const rpcMs = Math.round(performance.now() - rpcStart);

  if (error) {
    logMutationTiming("product-create", start, { rpcMs, outcome: "error", stage: "write_failed" });
    if (error.code === "23505")
      return { success: false, error: "מוצר עם slug זה כבר קיים" };
    return { success: false, error: "שגיאה ביצירת המוצר" };
  }

  return completeMutation(
    "product-create",
    start,
    `${ADMIN_BASE_PATH}/products`,
    () => {
      revalidatePath(`${ADMIN_BASE_PATH}/products`);
      revalidateStorefront();
    },
    { variantCount: variants.length }
  );
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateProduct(
  id: string,
  formData: FormData
): Promise<UpdateProductResult> {
  const start = performance.now();
  const authStart = start;
  await requireAdmin();
  const authMs = Math.round(performance.now() - authStart);

  const parsed = parseFormData(formData);
  if (!parsed) {
    logMutationTiming("product-update", start, { authMs, outcome: "validation-error", stage: "validation_failed" });
    return { success: false, error: "אימות נתונים נכשל. בדקו את הטופס." };
  }

  const supabase = await createAdminClient();
  const { variants, qty_deal_price, ...productFields } = parsed;

  // One round trip, one transaction: product update + the 1kg→unit price
  // sync + variant delete/upsert/insert, all inside
  // admin_save_product_with_variants. Previously this was 3-4 sequential
  // groups of Supabase calls (update+read → clear-defaults+delete →
  // upsert+insert) — each one paying full network latency to the DB.
  const rpcStart = performance.now();
  const { data, error } = await supabase.rpc("admin_save_product_with_variants", {
    p_product_id: id,
    p_category_id: productFields.category_id,
    p_name: productFields.name,
    p_slug: productFields.slug,
    p_description: productFields.description ?? "",
    p_image_url: productFields.image_url ?? "",
    p_is_active: productFields.is_active,
    p_is_featured: productFields.is_featured,
    p_sort_order: productFields.sort_order,
    p_qty_deal_enabled: productFields.qty_deal_enabled,
    p_qty_deal_quantity: productFields.qty_deal_enabled ? (productFields.qty_deal_quantity ?? null) : null,
    p_qty_deal_price_agorot: productFields.qty_deal_enabled && qty_deal_price != null
      ? Math.round(qty_deal_price * 100)
      : null,
    p_variants: variants.map(toRpcVariant),
  });
  const rpcMs = Math.round(performance.now() - rpcStart);

  if (error) {
    logMutationTiming("product-update", start, { authMs, rpcMs, outcome: "error", stage: "write_failed" });
    if (error.code === "23505")
      return { success: false, error: "מוצר עם slug זה כבר קיים" };
    if (error.code === "23503")
      return { success: false, error: "לא ניתן להסיר גרסאות שנמצאות בהזמנות קיימות" };
    return { success: false, error: "שגיאה בעדכון המוצר" };
  }

  // Real DB ids for every variant, including ones just inserted — the client
  // writes these back into its local form state so a second save (without a
  // page reload) upserts instead of inserting a duplicate. See
  // ProductForm.tsx's onSubmit and the RPC migration's own header comment.
  const savedVariants = (data as { variants?: RpcVariant[] } | null)?.variants ?? [];

  const result = await completeUpdateMutation(
    "product-update",
    start,
    () => {
      revalidatePath(`${ADMIN_BASE_PATH}/products`);
      revalidateStorefront();
      revalidatePath(`/product/${parsed.slug}`);
    },
    { authMs, rpcMs, variantCount: savedVariants.length }
  );

  return { ...result, variants: savedVariants };
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteProduct(id: string): Promise<ActionResult> {
  const start = performance.now();
  await requireAdmin();
  const supabase = await createAdminClient();

  const { error } = await supabase.from("products").delete().eq("id", id);

  if (error) {
    logMutationTiming("product-delete", start, { outcome: "error", stage: "write_failed" });
    if (error.code === "23503")
      return { success: false, error: "לא ניתן למחוק מוצר שנמצא בהזמנות קיימות" };
    return { success: false, error: "שגיאה במחיקת המוצר" };
  }

  return completeDeleteMutation("product-delete", start, () => {
    revalidatePath(`${ADMIN_BASE_PATH}/products`);
    revalidateStorefront();
  });
}
