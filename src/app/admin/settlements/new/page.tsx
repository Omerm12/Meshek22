import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { SettlementForm } from "@/components/admin/settlements/SettlementForm";
import { createSettlement } from "@/app/admin/settlements/actions";

export const metadata: Metadata = { title: "יישוב חדש" };

export default async function NewSettlementPage() {
  await requireAdmin();

  const supabase = await createAdminClient();
  const { data: zones } = await supabase
    .from("delivery_zones")
    .select("id, name")
    .eq("is_active", true)
    .order("name", { ascending: true });

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-400 mb-5" aria-label="פירורי לחם">
        <Link href="/admin/settlements" className="hover:text-gray-700 transition-colors">
          יישובים
        </Link>
        <ChevronRight className="h-3.5 w-3.5 rotate-180" aria-hidden="true" />
        <span className="text-gray-700 font-medium">חדש</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">יישוב חדש</h1>
        <p className="text-sm text-gray-500 mt-1">הוסיפו יישוב חדש למערכת המשלוחים</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-xl">
        <SettlementForm
          action={createSettlement}
          submitLabel="צרו יישוב"
          deliveryZones={zones ?? []}
        />
      </div>
    </div>
  );
}
