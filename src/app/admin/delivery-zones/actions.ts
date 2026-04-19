"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { deliveryZoneSchema } from "@/lib/validations/admin-delivery-zone";

// ── Shared result type ────────────────────────────────────────────────────────

export type ActionResult =
  | { success: true }
  | { success: false; error: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert ₪ string to integer agorot. Returns null if empty/falsy. */
function shekelToAgorot(value: string | null): number | null {
  if (!value || value.trim() === "") return null;
  const parsed = parseFloat(value);
  if (isNaN(parsed)) return null;
  return Math.round(parsed * 100);
}

function parseForm(formData: FormData) {
  // delivery_days comes as repeated form entries
  const deliveryDays = formData.getAll("delivery_days").map(String);

  const rawMinOrder = formData.get("min_order_shekel") as string | null;
  const minOrderStr = rawMinOrder?.trim();

  const rawFreeThreshold = formData.get("free_delivery_threshold_shekel") as string | null;
  const freeThresholdStr = rawFreeThreshold?.trim();

  return deliveryZoneSchema.safeParse({
    name:                             formData.get("name"),
    slug:                             formData.get("slug"),
    description:                      formData.get("description") ?? "",
    delivery_fee_shekel:              parseFloat(formData.get("delivery_fee_shekel") as string),
    min_order_shekel:                 minOrderStr ? parseFloat(minOrderStr) : null,
    free_delivery_threshold_shekel:   freeThresholdStr ? parseFloat(freeThresholdStr) : null,
    delivery_days:                    deliveryDays,
    estimated_delivery_hours:         formData.get("estimated_delivery_hours")
                                        ? parseInt(formData.get("estimated_delivery_hours") as string, 10)
                                        : null,
    is_active:                        formData.get("is_active") === "true",
    sort_order:                       parseInt(formData.get("sort_order") as string, 10),
  });
}

function revalidate() {
  revalidatePath("/admin/delivery-zones");
  // Settlements depend on delivery zones — refresh those too
  revalidatePath("/admin/settlements");
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createDeliveryZone(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים",
    };
  }

  const d = parsed.data;
  const supabase = await createAdminClient();

  const { error } = await supabase.from("delivery_zones").insert({
    name:                             d.name,
    slug:                             d.slug,
    description:                      d.description || null,
    delivery_fee_agorot:              Math.round(d.delivery_fee_shekel * 100),
    min_order_agorot:                 d.min_order_shekel != null ? Math.round(d.min_order_shekel * 100) : null,
    free_delivery_threshold_agorot:   d.free_delivery_threshold_shekel != null
                                        ? Math.round(d.free_delivery_threshold_shekel * 100)
                                        : null,
    delivery_days:                    d.delivery_days,
    estimated_delivery_hours:         d.estimated_delivery_hours ?? null,
    is_active:                        d.is_active,
    sort_order:                       d.sort_order,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        success: false,
        error: "קיים כבר אזור משלוח עם slug זה. בחרו slug אחר.",
      };
    }
    return { success: false, error: "שגיאה ביצירת אזור המשלוח. נסו שוב." };
  }

  revalidate();
  redirect("/admin/delivery-zones");
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateDeliveryZone(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים",
    };
  }

  const d = parsed.data;
  const supabase = await createAdminClient();

  const { error } = await supabase
    .from("delivery_zones")
    .update({
      name:                             d.name,
      slug:                             d.slug,
      description:                      d.description || null,
      delivery_fee_agorot:              Math.round(d.delivery_fee_shekel * 100),
      min_order_agorot:                 d.min_order_shekel != null ? Math.round(d.min_order_shekel * 100) : null,
      free_delivery_threshold_agorot:   d.free_delivery_threshold_shekel != null
                                          ? Math.round(d.free_delivery_threshold_shekel * 100)
                                          : null,
      delivery_days:                    d.delivery_days,
      estimated_delivery_hours:         d.estimated_delivery_hours ?? null,
      is_active:                        d.is_active,
      sort_order:                       d.sort_order,
      updated_at:                       new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return {
        success: false,
        error: "קיים כבר אזור משלוח עם slug זה. בחרו slug אחר.",
      };
    }
    return { success: false, error: "שגיאה בעדכון אזור המשלוח. נסו שוב." };
  }

  revalidate();
  redirect("/admin/delivery-zones");
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteDeliveryZone(id: string): Promise<ActionResult> {
  await requireAdmin();

  const supabase = await createAdminClient();

  // Check if any settlements still reference this zone.
  // The DB schema uses ON DELETE SET NULL, so deletion won't fail due to FK —
  // but we still want to warn the admin explicitly.
  const { count } = await supabase
    .from("settlements")
    .select("id", { count: "exact", head: true })
    .eq("delivery_zone_id", id);

  if (count && count > 0) {
    return {
      success: false,
      error: `לא ניתן למחוק אזור משלוח זה כי ${count} יישובים משויכים אליו. שנו את אזור המשלוח של היישובים האלה תחילה, או בטלו את השיוך שלהם.`,
    };
  }

  const { error } = await supabase
    .from("delivery_zones")
    .delete()
    .eq("id", id);

  if (error) {
    if (error.code === "23503") {
      return {
        success: false,
        error:
          "לא ניתן למחוק אזור משלוח זה כי יש רשומות המשויכות אליו. הסירו תחילה את הקישורים.",
      };
    }
    return { success: false, error: "שגיאה במחיקת אזור המשלוח. נסו שוב." };
  }

  revalidate();
  return { success: true };
}
