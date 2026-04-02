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
  return categorySchema.safeParse({
    name:        formData.get("name"),
    slug:        formData.get("slug"),
    description: formData.get("description") ?? "",
    image_url:   formData.get("image_url") ?? "",
    sort_order:  formData.get("sort_order"),
    is_active:   formData.get("is_active") === "true",
  });
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createCategory(
  formData: FormData
): Promise<ActionResult> {
  // Every action re-verifies admin status server-side.
  // A non-admin can never reach this code path, even by crafting a direct POST.
  await requireAdmin();

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  }

  const supabase = await createAdminClient();
  const { error } = await supabase.from("categories").insert({
    name:        parsed.data.name,
    slug:        parsed.data.slug,
    description: parsed.data.description || null,
    image_url:   parsed.data.image_url || null,
    sort_order:  parsed.data.sort_order,
    is_active:   parsed.data.is_active,
  });

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "קיימת כבר קטגוריה עם slug זה. בחרו slug אחר." };
    }
    return { success: false, error: "שגיאה ביצירת הקטגוריה. נסו שוב." };
  }

  revalidatePath("/admin/categories");
  revalidatePath("/");              // storefront homepage (ISR)
  revalidatePath("/category/[slug]", "layout"); // storefront category pages

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

  redirect("/admin/categories");
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteCategory(id: string): Promise<ActionResult> {
  await requireAdmin();

  const supabase = await createAdminClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);

  if (error) {
    // PostgreSQL FK violation — products reference this category
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

  return { success: true };
}
