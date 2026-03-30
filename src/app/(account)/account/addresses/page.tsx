import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AddressCard } from "@/components/account/AddressCard";
import type { Database } from "@/types/database";

type AddressRow = Database["public"]["Tables"]["addresses"]["Row"];

export const metadata: Metadata = {
  title: "כתובות משלוח",
};

export default async function AddressesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("addresses")
    .select("*")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  const addresses = (data ?? []) as AddressRow[];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">כתובות משלוח</h1>
        <Link
          href="/account/addresses/new"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          כתובת חדשה
        </Link>
      </div>

      {addresses.length > 0 ? (
        <div className="space-y-3">
          {addresses.map((address) => (
            <AddressCard key={address.id} address={address} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-100 p-10 text-center">
          <p className="text-stone-500 text-sm mb-4">עדיין לא הוספתם כתובת משלוח</p>
          <Link
            href="/account/addresses/new"
            className="inline-flex items-center gap-2 h-9 px-5 rounded-full bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            הוסיפו כתובת
          </Link>
        </div>
      )}
    </div>
  );
}
