import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Truck, Pencil } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { DeleteDeliveryZoneButton } from "@/components/admin/delivery-zones/DeleteDeliveryZoneButton";

export const metadata: Metadata = { title: "אזורי משלוח" };
export const dynamic = "force-dynamic";

/** Format agorot integer as ₪ string, e.g. 3500 → "₪35.00" */
function formatShekel(agorot: number | null): string {
  if (agorot == null) return "—";
  return `₪${(agorot / 100).toFixed(2)}`;
}

export default async function AdminDeliveryZonesPage() {
  await requireAdmin();

  const supabase = await createAdminClient();
  const { data: zones, error } = await supabase
    .from("delivery_zones")
    .select(
      "id, name, slug, delivery_fee_agorot, min_order_agorot, free_delivery_threshold_agorot, is_active, sort_order, delivery_days"
    )
    .order("sort_order", { ascending: true })
    .order("name",       { ascending: true });

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700 text-sm">
        שגיאה בטעינת אזורי המשלוח. נסו לרענן את הדף.
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">אזורי משלוח</h1>
          <p className="text-sm text-gray-500 mt-1">
            {zones.length} אזורי משלוח במערכת
          </p>
        </div>
        <Link
          href="/admin/delivery-zones/new"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          אזור חדש
        </Link>
      </div>

      {/* Empty state */}
      {zones.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="h-14 w-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Truck className="h-7 w-7 text-gray-300" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-gray-900 mb-1">אין אזורי משלוח עדיין</p>
          <p className="text-sm text-gray-400 mb-5">צרו את אזור המשלוח הראשון</p>
          <Link
            href="/admin/delivery-zones/new"
            className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            אזור חדש
          </Link>
        </div>
      )}

      {/* Table */}
      {zones.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" dir="rtl">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-right px-5 py-3 font-medium text-gray-500">שם</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500">Slug</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500">דמי משלוח</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500">מינ׳ הזמנה</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500">משלוח חינם מ-</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500">ימי משלוח</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500">סטטוס</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {zones.map((zone) => (
                  <tr key={zone.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="font-medium text-gray-900">{zone.name}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <code className="text-xs bg-gray-100 px-2 py-0.5 rounded-md text-gray-600 font-mono" dir="ltr">
                        {zone.slug}
                      </code>
                    </td>
                    <td className="px-5 py-3.5 text-gray-700 tabular-nums">
                      {formatShekel(zone.delivery_fee_agorot)}
                    </td>
                    <td className="px-5 py-3.5 text-gray-700 tabular-nums">
                      {(zone.min_order_agorot ?? 0) > 0 ? formatShekel(zone.min_order_agorot) : "ללא"}
                    </td>
                    <td className="px-5 py-3.5 text-gray-700 tabular-nums">
                      {zone.free_delivery_threshold_agorot
                        ? formatShekel(zone.free_delivery_threshold_agorot)
                        : "ללא"}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {(zone.delivery_days ?? []).map((day: string) => (
                          <span
                            key={day}
                            className="inline-flex items-center h-5 px-2 rounded-full text-xs bg-blue-50 text-blue-700"
                          >
                            {day}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={[
                          "inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold",
                          zone.is_active
                            ? "bg-green-50 text-green-700"
                            : "bg-gray-100 text-gray-500",
                        ].join(" ")}
                      >
                        {zone.is_active ? "פעיל" : "לא פעיל"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/delivery-zones/${zone.id}/edit`}
                          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 border border-transparent hover:border-gray-200 transition-colors"
                          aria-label={`ערוך אזור ${zone.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          עריכה
                        </Link>
                        <DeleteDeliveryZoneButton id={zone.id} name={zone.name} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
