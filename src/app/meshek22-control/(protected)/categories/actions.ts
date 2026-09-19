"use server";

import { revalidatePath } from "next/cache";
import { revalidateStorefront } from "@/lib/admin/revalidate";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { categorySchema } from "@/lib/validations/admin-category";
import { ADMIN_BASE_PATH } from "@/lib/admin/routes";
import { completeMutation, logMutationTiming } from "@/lib/admin/instrumentation";

// ── Shared result types ───────────────────────────────────────────────────────

export type ActionResult =
  | { success: true }
  | { success: false; error: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseForm(formData: FormData) {
  const rawParentId = (formData.get("parent_id") as string | null) ?? "";
  return categorySchema.safeParse({
    name:        formData.get("name"),
    slug:        formData.get("slug"),
    description: formData.get("description") ?? "",
    image_url:   formData.get("image_url") ?? "",
    sort_order:  Number(formData.get("sort_order")),
    is_active:   formData.get("is_active")   === "true",
    is_featured: formData.get("is_featured") === "true",
    show_in_navbar: formData.get("show_in_navbar") === "true",
    show_as_top_level_nav: formData.get("show_as_top_level_nav") === "true",
    parent_id:   rawParentId,
  });
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createCategory(
  formData: FormData
): Promise<ActionResult> {
  const start = performance.now();
  await requireAdmin();

  const parsed = parseForm(formData);
  if (!parsed.success) {
    logMutationTiming("category-create", start, { outcome: "validation-error", stage: "validation_failed" });
    return { success: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  }

  const parentId = parsed.data.parent_id || null;

  const supabase = await createAdminClient();
  const { error } = await supabase.from("categories").insert({
    name:        parsed.data.name,
    slug:        parsed.data.slug,
    description: parsed.data.description || null,
    image_url:   parsed.data.image_url || null,
    sort_order:  parsed.data.sort_order,
    is_active:   parsed.data.is_active,
    is_featured: parsed.data.is_featured,
    show_in_navbar: parsed.data.show_in_navbar,
    show_as_top_level_nav: parsed.data.show_as_top_level_nav,
    parent_id:   parentId,
  });

  if (error) {
    logMutationTiming("category-create", start, { outcome: "error", stage: "write_failed" });
    if (error.code === "23505") {
      return { success: false, error: "קיימת כבר קטגוריה עם slug זה. בחרו slug אחר." };
    }
    return { success: false, error: "שגיאה ביצירת הקטגוריה. נסו שוב." };
  }

  completeMutation("category-create", start, `${ADMIN_BASE_PATH}/categories`, () => {
    revalidatePath(`${ADMIN_BASE_PATH}/categories`);
    revalidateStorefront();
  });
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateCategory(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const start = performance.now();
  const authStart = start;
  await requireAdmin();
  const authMs = Math.round(performance.now() - authStart);

  const parsed = parseForm(formData);
  if (!parsed.success) {
    logMutationTiming("category-update", start, { authMs, outcome: "validation-error", stage: "validation_failed" });
    return { success: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  }

  // Prevent self-parenting
  const parentId = parsed.data.parent_id || null;
  if (parentId === id) {
    logMutationTiming("category-update", start, { authMs, outcome: "rejected", stage: "validation_failed" });
    return { success: false, error: "קטגוריה לא יכולה להיות קטגוריית האב של עצמה." };
  }

  const supabase = await createAdminClient();
  const dbStart = performance.now();
  const { error } = await supabase
    .from("categories")
    .update({
      name:        parsed.data.name,
      slug:        parsed.data.slug,
      description: parsed.data.description || null,
      image_url:   parsed.data.image_url || null,
      sort_order:  parsed.data.sort_order,
      is_active:   parsed.data.is_active,
      is_featured: parsed.data.is_featured,
      show_in_navbar: parsed.data.show_in_navbar,
      show_as_top_level_nav: parsed.data.show_as_top_level_nav,
      parent_id:   parentId,
    })
    .eq("id", id);
  const dbMs = Math.round(performance.now() - dbStart);

  if (error) {
    logMutationTiming("category-update", start, { authMs, dbMs, outcome: "error", stage: "write_failed" });
    if (error.code === "23505") {
      return { success: false, error: "קיימת כבר קטגוריה עם slug זה. בחרו slug אחר." };
    }
    return { success: false, error: "שגיאה בעדכון הקטגוריה. נסו שוב." };
  }

  completeMutation(
    "category-update",
    start,
    `${ADMIN_BASE_PATH}/categories`,
    () => {
      revalidatePath(`${ADMIN_BASE_PATH}/categories`);
      revalidateStorefront();
    },
    { authMs, dbMs }
  );
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteCategory(id: string): Promise<ActionResult> {
  const start = performance.now();
  await requireAdmin();

  const supabase = await createAdminClient();

  // Prevent deleting a parent that still has children
  const { count: childCount } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", id);

  if (childCount && childCount > 0) {
    logMutationTiming("category-delete", start, { outcome: "rejected" });
    return {
      success: false,
      error:
        "לא ניתן למחוק קטגוריה זו כי יש תתי-קטגוריות המשויכות אליה. מחקו אותן תחילה.",
    };
  }

  const { error } = await supabase.from("categories").delete().eq("id", id);

  if (error) {
    logMutationTiming("category-delete", start, { outcome: "error", stage: "write_failed" });
    if (error.code === "23503") {
      return {
        success: false,
        error:
          "לא ניתן למחוק קטגוריה זו כי יש מוצרים המשויכים אליה. העבירו או מחקו את המוצרים תחילה.",
      };
    }
    return { success: false, error: "שגיאה במחיקת הקטגוריה. נסו שוב." };
  }

  revalidatePath(`${ADMIN_BASE_PATH}/categories`);
  revalidateStorefront();

  logMutationTiming("category-delete", start, { outcome: "success", stage: "write_succeeded" });
  return { success: true };
}
