import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { DeliveryZoneForm } from "@/components/admin/delivery-zones/DeliveryZoneForm";
import { createDeliveryZone } from "@/app/admin/delivery-zones/actions";

export const metadata: Metadata = { title: "אזור משלוח חדש" };

export default async function NewDeliveryZonePage() {
  await requireAdmin();

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-400 mb-5" aria-label="פירורי לחם">
        <Link href="/admin/delivery-zones" className="hover:text-gray-700 transition-colors">
          אזורי משלוח
        </Link>
        <ChevronRight className="h-3.5 w-3.5 rotate-180" aria-hidden="true" />
        <span className="text-gray-700 font-medium">חדש</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">אזור משלוח חדש</h1>
        <p className="text-sm text-gray-500 mt-1">הוסיפו אזור משלוח חדש למערכת</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-2xl">
        <DeliveryZoneForm action={createDeliveryZone} submitLabel="צרו אזור משלוח" />
      </div>
    </div>
  );
}
