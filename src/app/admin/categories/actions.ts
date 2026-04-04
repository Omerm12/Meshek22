"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { categorySchema } from "@/lib/validations/admin-category";

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
    is_active:   formData.get("is_active") === "true",
    parent_id:   rawParentId,
  });
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createCategory(
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = parseForm(formData);
  if (!parsed.success) {
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
    parent_id:   parentId,
  });

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "קיימת כבר קטגוריה עם slug זה. בחרו slug אחר." };
    }
    return { success: false, error: "שגיאה ביצירת הקטגוריה. נסו שוב." };
  }

  revalidatePath("/admin/categories");
  revalidatePath("/");
  revalidatePath("/category/[slug]", "layout");
  revalidatePath("/vegetables");
  revalidatePath("/fruits");

  redirect("/admin/categories");
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateCategory(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  }

  // Prevent self-parenting
  const parentId = parsed.data.parent_id || null;
  if (parentId === id) {
    return { success: false, error: "קטגוריה לא יכולה להיות קטגוריית האב של עצמה." };
  }

  const supabase = await createAdminClient();
  const { error } = await supabase
    .from("categories")
    .update({
      name:        parsed.data.name,
      slug:        parsed.data.slug,
      description: parsed.data.description || null,
      image_url:   parsed.data.image_url || null,
      sort_order:  parsed.data.sort_order,
      is_active:   parsed.data.is_active,
      parent_id:   parentId,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "קיימת כבר קטגוריה עם slug זה. בחרו slug אחר." };
    }
    return { success: false, error: "שגיאה בעדכון הקטגוריה. נסו שוב." };
  }

  revalidatePath("/admin/categories");
  revalidatePath("/");
  revalidatePath("/category/[slug]", "layout");
  revalidatePath("/vegetables");
  revalidatePath("/fruits");

  redirect("/admin/categories");
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteCategory(id: string): Promise<ActionResult> {
  await requireAdmin();

  const supabase = await createAdminClient();

  // Prevent deleting a parent that still has children
  const { count: childCount } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", id);

  if (childCount && childCount > 0) {
    return {
      success: false,
      error:
        "לא ניתן למחוק קטגוריה זו כי יש תתי-קטגוריות המשויכות אליה. מחקו אותן תחילה.",
    };
  }

  const { error } = await supabase.from("categories").delete().eq("id", id);

  if (error) {
    if (error.code === "23503") {
      return {
        success: false,
        error:
          "לא ניתן למחוק קטגוריה זו כי יש מוצרים המשויכים אליה. העבירו או מחקו את המוצרים תחילה.",
      };
    }
    return { success: false, error: "שגיאה במחיקת הקטגוריה. נסו שוב." };
  }

  revalidatePath("/admin/categories");
  revalidatePath("/");
  revalidatePath("/category/[slug]", "layout");
  revalidatePath("/vegetables");
  revalidatePath("/fruits");

  return { success: true };
}
