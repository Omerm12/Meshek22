import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { DeliveryZoneForm } from "@/components/admin/delivery-zones/DeliveryZoneForm";
import { updateDeliveryZone } from "@/app/admin/delivery-zones/actions";

export const metadata: Metadata = { title: "עריכת אזור משלוח" };

export default async function EditDeliveryZonePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id } = await params;

  const supabase = await createAdminClient();
  const { data: zone, error } = await supabase
    .from("delivery_zones")
    .select(
      "id, name, slug, description, delivery_fee_agorot, min_order_agorot, free_delivery_threshold_agorot, delivery_days, estimated_delivery_hours, is_active, sort_order"
    )
    .eq("id", id)
    .single();

  if (error || !zone) notFound();

  // Convert agorot → ₪ floats for the form
  const actionWithId = updateDeliveryZone.bind(null, zone.id);

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-400 mb-5" aria-label="פירורי לחם">
        <Link href="/admin/delivery-zones" className="hover:text-gray-700 transition-colors">
          אזורי משלוח
        </Link>
        <ChevronRight className="h-3.5 w-3.5 rotate-180" aria-hidden="true" />
        <span className="text-gray-700 font-medium">{zone.name}</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">עריכת אזור משלוח</h1>
        <p className="text-sm text-gray-500 mt-1">
          עדכנו את פרטי האזור{" "}
          <span className="font-medium text-gray-700">{zone.name}</span>
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-2xl">
        <DeliveryZoneForm
          defaultValues={{
            name:                             zone.name,
            slug:                             zone.slug,
            description:                      zone.description ?? "",
            delivery_fee_shekel:              zone.delivery_fee_agorot / 100,
            min_order_shekel:                 zone.min_order_agorot / 100,
            free_delivery_threshold_shekel:   zone.free_delivery_threshold_agorot != null
                                                ? zone.free_delivery_threshold_agorot / 100
                                                : null,
            delivery_days:                    zone.delivery_days ?? [],
            estimated_delivery_hours:         zone.estimated_delivery_hours ?? null,
            is_active:                        zone.is_active,
            sort_order:                       zone.sort_order,
          }}
          action={actionWithId}
          submitLabel="שמרו שינויים"
        />
      </div>
    </div>
  );
}
