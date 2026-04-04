import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { SettlementForm } from "@/components/admin/settlements/SettlementForm";
import { updateSettlement } from "@/app/admin/settlements/actions";

export const metadata: Metadata = { title: "עריכת יישוב" };

export default async function EditSettlementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id } = await params;

  const supabase = await createAdminClient();

  // Fetch settlement and all zones in parallel
  const [{ data: settlement, error }, { data: zones }] = await Promise.all([
    supabase
      .from("settlements")
      .select("id, name, delivery_zone_id, is_active")
      .eq("id", id)
      .single(),
    supabase
      .from("delivery_zones")
      .select("id, name")
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);

  if (error || !settlement) notFound();

  const actionWithId = updateSettlement.bind(null, settlement.id);

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-400 mb-5" aria-label="פירורי לחם">
        <Link href="/admin/settlements" className="hover:text-gray-700 transition-colors">
          יישובים
        </Link>
        <ChevronRight className="h-3.5 w-3.5 rotate-180" aria-hidden="true" />
        <span className="text-gray-700 font-medium">{settlement.name}</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">עריכת יישוב</h1>
        <p className="text-sm text-gray-500 mt-1">
          עדכנו את פרטי היישוב{" "}
          <span className="font-medium text-gray-700">{settlement.name}</span>
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-xl">
        <SettlementForm
          defaultValues={{
            name:             settlement.name,
            delivery_zone_id: settlement.delivery_zone_id ?? null,
            is_active:        settlement.is_active,
          }}
          action={actionWithId}
          submitLabel="שמרו שינויים"
          deliveryZones={zones ?? []}
        />
      </div>
    </div>
  );
}
