import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/account/ProfileForm";

export const metadata: Metadata = {
  title: "הפרופיל שלי",
};

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Profile missing — this shouldn't happen when the DB trigger is in place,
  // but handle it defensively to avoid a /login redirect loop.
  if (!profile) {
    const { data: created } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        email: user.email ?? null,
        full_name: (user.user_metadata?.full_name as string) ?? null,
        phone: (user.user_metadata?.phone as string) ?? null,
      })
      .select()
      .single();

    if (created) {
      // Re-render with the freshly created row
      profile = created;
    } else {
      // Insert failed (RLS or constraint). Show a recoverable error instead of looping.
      return (
        <div className="bg-white rounded-2xl border border-stone-100 p-6 max-w-md">
          <p className="text-sm text-stone-500">
            לא ניתן היה לטעון את הפרופיל. נסו לרענן את הדף.
          </p>
        </div>
      );
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">הפרופיל שלי</h1>
      <div className="bg-white rounded-2xl border border-stone-100 p-6 max-w-md">
        <ProfileForm profile={profile} />
      </div>
    </div>
  );
}
