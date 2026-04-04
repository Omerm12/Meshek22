"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { settlementSchema } from "@/lib/validations/admin-settlement";

// ── Shared result type ────────────────────────────────────────────────────────

export type ActionResult =
  | { success: true }
  | { success: false; error: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseForm(formData: FormData) {
  const zoneId = formData.get("delivery_zone_id") as string | null;

  return settlementSchema.safeParse({
    name:             formData.get("name"),
    delivery_zone_id: zoneId?.trim() ? zoneId.trim() : null,
    is_active:        formData.get("is_active") === "true",
  });
}

function revalidate() {
  revalidatePath("/admin/settlements");
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createSettlement(formData: FormData): Promise<ActionResult> {
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

  const { error } = await supabase.from("settlements").insert({
    name:             d.name,
    delivery_zone_id: d.delivery_zone_id ?? null,
    is_active:        d.is_active,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        success: false,
        error: "קיים כבר יישוב עם שם זה. בחרו שם אחר.",
      };
    }
    return { success: false, error: "שגיאה ביצירת היישוב. נסו שוב." };
  }

  revalidate();
  redirect("/admin/settlements");
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateSettlement(
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
    .from("settlements")
    .update({
      name:             d.name,
      delivery_zone_id: d.delivery_zone_id ?? null,
      is_active:        d.is_active,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return {
        success: false,
        error: "קיים כבר יישוב עם שם זה. בחרו שם אחר.",
      };
    }
    return { success: false, error: "שגיאה בעדכון היישוב. נסו שוב." };
  }

  revalidate();
  redirect("/admin/settlements");
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteSettlement(id: string): Promise<ActionResult> {
  await requireAdmin();

  const supabase = await createAdminClient();
  const { error } = await supabase.from("settlements").delete().eq("id", id);

  if (error) {
    if (error.code === "23503") {
      return {
        success: false,
        error:
          "לא ניתן למחוק יישוב זה כי הוא מפוזר בהזמנות קיימות. בטלו את ההזמנות תחילה.",
      };
    }
    return { success: false, error: "שגיאה במחיקת היישוב. נסו שוב." };
  }

  revalidate();
  return { success: true };
}
