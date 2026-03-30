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

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">הפרופיל שלי</h1>
      <div className="bg-white rounded-2xl border border-stone-100 p-6 max-w-md">
        <ProfileForm profile={profile} />
      </div>
    </div>
  );
}
