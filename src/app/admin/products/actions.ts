"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { productFormSchema, type ProductFormData } from "@/lib/validations/admin-product";

export type ActionResult = { success: true } | { success: false; error: string };

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

// ─── Variant → DB row ─────────────────────────────────────────────────────────

function toDbVariant(
  v: ProductFormData["variants"][number],
  productId: string
) {
  return {
    ...(v.id ? { id: v.id } : {}),
    product_id:            productId,
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
  await requireAdmin();

  const parsed = parseFormData(formData);
  if (!parsed) return { success: false, error: "אימות נתונים נכשל. בדקו את הטופס." };

  const supabase = await createAdminClient();
  const { variants, qty_deal_price, ...productFields } = parsed;

  const productRecord = {
    ...productFields,
    qty_deal_price_agorot: productFields.qty_deal_enabled && qty_deal_price != null
      ? Math.round(qty_deal_price * 100)
      : null,
    qty_deal_quantity: productFields.qty_deal_enabled ? (productFields.qty_deal_quantity ?? null) : null,
  };

  const { data: product, error: productError } = await supabase
    .from("products")
    .insert(productRecord)
    .select("id")
    .single();

  if (productError) {
    if (productError.code === "23505")
      return { success: false, error: "מוצר עם slug זה כבר קיים" };
    return { success: false, error: "שגיאה ביצירת המוצר" };
  }

  const { error: variantsError } = await supabase
    .from("product_variants")
    .insert(variants.map((v) => toDbVariant(v, product.id)));

  if (variantsError) {
    await supabase.from("products").delete().eq("id", product.id);
    return { success: false, error: "שגיאה ביצירת הגרסאות. המוצר לא נשמר." };
  }

  revalidatePath("/admin/products");
  revalidatePath("/");
  redirect("/admin/products");
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateProduct(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = parseFormData(formData);
  if (!parsed) return { success: false, error: "אימות נתונים נכשל. בדקו את הטופס." };

  const supabase = await createAdminClient();
  const { variants, qty_deal_price, ...productFields } = parsed;

  const productRecord = {
    ...productFields,
    qty_deal_price_agorot: productFields.qty_deal_enabled && qty_deal_price != null
      ? Math.round(qty_deal_price * 100)
      : null,
    qty_deal_quantity: productFields.qty_deal_enabled ? (productFields.qty_deal_quantity ?? null) : null,
  };

  // 1. Update product record
  const { error: productError } = await supabase
    .from("products")
    .update(productRecord)
    .eq("id", id);

  if (productError) {
    if (productError.code === "23505")
      return { success: false, error: "מוצר עם slug זה כבר קיים" };
    return { success: false, error: "שגיאה בעדכון המוצר" };
  }

  // 2. Fetch current variants (need price + unit for kg→unit price sync)
  const { data: currentVariants } = await supabase
    .from("product_variants")
    .select("id, unit, price_agorot, compare_price_agorot")
    .eq("product_id", id);

  // 3. Unit-price sync: if the 1kg variant price changed, update the 'unit'
  //    variant price proportionally (same percentage change).
  //    This runs before the upsert so the adjusted price is what gets saved.
  const mutableVariants = variants.map((v) => ({ ...v }));

  const currentKg = (currentVariants ?? []).find((v) => v.unit === "1kg");
  const newKgIdx  = mutableVariants.findIndex((v) => v.unit === "1kg" && v.id);

  if (currentKg && newKgIdx >= 0) {
    const oldKgAgorot = currentKg.price_agorot;
    const newKgAgorot = Math.round(mutableVariants[newKgIdx].price * 100);

    if (oldKgAgorot !== newKgAgorot && oldKgAgorot > 0) {
      const ratio = newKgAgorot / oldKgAgorot;

      // Find the 'unit' variant in the current DB state and in the submitted form
      const currentUnit = (currentVariants ?? []).find((v) => v.unit === "unit");
      const newUnitIdx  = mutableVariants.findIndex((v) => v.unit === "unit");

      if (currentUnit && newUnitIdx >= 0) {
        // Sync price
        mutableVariants[newUnitIdx].price =
          Math.round(currentUnit.price_agorot * ratio) / 100;

        // Sync compare_price if the unit variant has one
        if (currentUnit.compare_price_agorot != null) {
          mutableVariants[newUnitIdx].compare_price =
            Math.round(currentUnit.compare_price_agorot * ratio) / 100;
        }
      }
    }
  }

  // 4. Determine which existing variants were removed
  const submittedIds = mutableVariants.filter((v) => v.id).map((v) => v.id!);
  const currentIds   = (currentVariants ?? []).map((v) => v.id);
  const idsToDelete  = currentIds.filter((cid) => !submittedIds.includes(cid));

  if (idsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("product_variants")
      .delete()
      .in("id", idsToDelete);

    if (deleteError) {
      if (deleteError.code === "23503")
        return { success: false, error: "לא ניתן להסיר גרסאות שנמצאות בהזמנות קיימות" };
      return { success: false, error: "שגיאה במחיקת גרסאות" };
    }
  }

  // 5. Clear defaults first to avoid unique-partial-index violation during upsert
  await supabase
    .from("product_variants")
    .update({ is_default: false })
    .eq("product_id", id);

  // 6. Upsert existing variants (have id)
  const existingVariants = mutableVariants.filter((v) => v.id);
  if (existingVariants.length > 0) {
    const { error } = await supabase
      .from("product_variants")
      .upsert(existingVariants.map((v) => toDbVariant(v, id)), { onConflict: "id" });
    if (error) return { success: false, error: "שגיאה בעדכון גרסאות" };
  }

  // 7. Insert new variants (no id)
  const newVariants = mutableVariants.filter((v) => !v.id);
  if (newVariants.length > 0) {
    const { error } = await supabase
      .from("product_variants")
      .insert(newVariants.map((v) => toDbVariant(v, id)));
    if (error) return { success: false, error: "שגיאה ביצירת גרסאות חדשות" };
  }

  revalidatePath("/admin/products");
  revalidatePath("/");
  revalidatePath(`/product/${parsed.slug}`);
  redirect("/admin/products");
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteProduct(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createAdminClient();

  const { error } = await supabase.from("products").delete().eq("id", id);

  if (error) {
    if (error.code === "23503")
      return { success: false, error: "לא ניתן למחוק מוצר שנמצא בהזמנות קיימות" };
    return { success: false, error: "שגיאה במחיקת המוצר" };
  }

  revalidatePath("/admin/products");
  revalidatePath("/");
  return { success: true };
}
