"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addressSchema } from "@/lib/validations/address";
import type { Database } from "@/types/database";
import { z } from "zod";

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
type AddressInsert = Database["public"]["Tables"]["addresses"]["Insert"];
type AddressUpdate = Database["public"]["Tables"]["addresses"]["Update"];

const profileSchema = z.object({
  full_name: z.string().min(2, "נא להזין שם מלא").max(100),
  phone: z
    .string()
    .regex(/^0\d{8,9}$/, "מספר טלפון לא תקין")
    .optional()
    .or(z.literal("")),
});

// ── Profile ──────────────────────────────────────────────────────────────────

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = profileSchema.safeParse({
    full_name: formData.get("full_name"),
    phone: formData.get("phone") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  }

  const update: ProfileUpdate = {
    full_name: parsed.data.full_name,
    phone: parsed.data.phone || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);

  if (error) return { error: "שגיאה בעדכון הפרופיל" };

  revalidatePath("/account");
  return { success: true };
}

// ── Addresses ────────────────────────────────────────────────────────────────

export async function saveAddress(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const floor = (formData.get("floor") as string) ?? "";
  const apartment = (formData.get("apartment") as string) ?? "";
  // Combine floor + apartment into the apartment column (DB has no floor column)
  const combinedApartment = [
    apartment ? `דירה ${apartment}` : "",
    floor ? `קומה ${floor}` : "",
  ]
    .filter(Boolean)
    .join(", ");

  const parsed = addressSchema.safeParse({
    label: formData.get("label") ?? undefined,
    street: formData.get("street"),
    house_number: formData.get("house_number"),
    floor,
    apartment,
    city: formData.get("city"),
    zip_code: formData.get("zip_code") ?? undefined,
    notes: formData.get("notes") ?? undefined,
    is_default: formData.get("is_default") === "true",
    delivery_zone_id: formData.get("delivery_zone_id") ?? null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  }

  const id = formData.get("id") as string | null;
  const isDefault = parsed.data.is_default;

  // If marking as default, unset others first
  if (isDefault) {
    const unsetUpdate: AddressUpdate = { is_default: false };
    await supabase.from("addresses").update(unsetUpdate).eq("user_id", user.id);
  }

  if (id) {
    const addressUpdate: AddressUpdate = {
      label: parsed.data.label || null,
      street: parsed.data.street,
      house_number: parsed.data.house_number,
      apartment: combinedApartment || null,
      city: parsed.data.city,
      zip_code: parsed.data.zip_code || null,
      notes: parsed.data.notes || null,
      is_default: isDefault ?? false,
      delivery_zone_id: parsed.data.delivery_zone_id ?? null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("addresses")
      .update(addressUpdate)
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) return { error: "שגיאה בעדכון הכתובת" };
  } else {
    const addressInsert: AddressInsert = {
      user_id: user.id,
      label: parsed.data.label || null,
      street: parsed.data.street,
      house_number: parsed.data.house_number,
      apartment: combinedApartment || null,
      city: parsed.data.city,
      zip_code: parsed.data.zip_code || null,
      notes: parsed.data.notes || null,
      is_default: isDefault ?? false,
      delivery_zone_id: parsed.data.delivery_zone_id ?? null,
    };
    const { error } = await supabase.from("addresses").insert(addressInsert);
    if (error) return { error: "שגיאה בשמירת הכתובת" };
  }

  revalidatePath("/account/addresses");
  redirect("/account/addresses");
}

export async function deleteAddress(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("addresses").delete().eq("id", id).eq("user_id", user.id);

  revalidatePath("/account/addresses");
}

export async function setDefaultAddress(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const unsetUpdate: AddressUpdate = { is_default: false };
  const setUpdate: AddressUpdate = { is_default: true };

  // Unset all, then set selected
  await supabase.from("addresses").update(unsetUpdate).eq("user_id", user.id);
  await supabase.from("addresses").update(setUpdate).eq("id", id).eq("user_id", user.id);

  revalidatePath("/account/addresses");
}
