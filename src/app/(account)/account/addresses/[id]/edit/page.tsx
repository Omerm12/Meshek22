import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AddressForm } from "@/components/account/AddressForm";

export const metadata: Metadata = {
  title: "עריכת כתובת",
};

export default async function EditAddressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: address } = await supabase
    .from("addresses")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!address) notFound();

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-6">
        <Link href="/account/addresses" className="hover:text-brand-700 transition-colors">
          כתובות משלוח
        </Link>
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
        <span className="text-gray-700 font-medium">עריכת כתובת</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">עריכת כתובת</h1>

      <div className="bg-white rounded-2xl border border-stone-100 p-6 max-w-md">
        <AddressForm address={address} />
      </div>
    </div>
  );
}
