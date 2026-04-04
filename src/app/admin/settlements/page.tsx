import type { Metadata } from "next";
import Link from "next/link";
import { Plus, MapPin, Pencil } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { DeleteSettlementButton } from "@/components/admin/settlements/DeleteSettlementButton";

export const metadata: Metadata = { title: "יישובים" };
export const dynamic = "force-dynamic";

export default async function AdminSettlementsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; zone?: string }>;
}) {
  await requireAdmin();

  const { q, zone } = await searchParams;

  const supabase = await createAdminClient();

  // Fetch all active zones for the filter dropdown
  const { data: zones } = await supabase
    .from("delivery_zones")
    .select("id, name")
    .order("name", { ascending: true });

  // Build the settlements query with optional filters
  let query = supabase
    .from("settlements")
    .select(
      "id, name, is_active, delivery_zone_id, delivery_zones(name)"
    )
    .order("name", { ascending: true });

  if (q?.trim()) {
    query = query.ilike("name", `%${q.trim()}%`);
  }
  if (zone?.trim()) {
    if (zone === "unassigned") {
      query = query.is("delivery_zone_id", null);
    } else {
      query = query.eq("delivery_zone_id", zone.trim());
    }
  }

  const { data: settlements, error } = await query;

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700 text-sm">
        שגיאה בטעינת היישובים. נסו לרענן את הדף.
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">יישובים</h1>
          <p className="text-sm text-gray-500 mt-1">
            {settlements.length} יישובים
            {q || zone ? " (מסוננים)" : " במערכת"}
          </p>
        </div>
        <Link
          href="/admin/settlements/new"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          יישוב חדש
        </Link>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="חיפוש לפי שם יישוב..."
          className="h-10 bg-white border border-gray-200 rounded-xl px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow min-w-[200px]"
        />
        <select
          name="zone"
          defaultValue={zone ?? ""}
          className="h-10 bg-white border border-gray-200 rounded-xl px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
        >
          <option value="">כל אזורי המשלוח</option>
          <option value="unassigned">ללא אזור משלוח</option>
          {(zones ?? []).map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-10 px-4 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors cursor-pointer"
        >
          סנן
        </button>
        {(q || zone) && (
          <Link
            href="/admin/settlements"
            className="h-10 px-4 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50 transition-colors inline-flex items-center"
          >
            נקה סינון
          </Link>
        )}
      </form>

      {/* Empty state */}
      {settlements.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="h-14 w-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MapPin className="h-7 w-7 text-gray-300" aria-hidden="true" />
          </div>
          {q || zone ? (
            <>
              <p className="text-sm font-medium text-gray-900 mb-1">לא נמצאו יישובים</p>
              <p className="text-sm text-gray-400 mb-4">נסו לשנות את פרמטרי הסינון</p>
              <Link
                href="/admin/settlements"
                className="inline-flex items-center gap-2 h-9 px-4 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                נקה סינון
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-900 mb-1">אין יישובים עדיין</p>
              <p className="text-sm text-gray-400 mb-5">צרו את היישוב הראשון</p>
              <Link
                href="/admin/settlements/new"
                className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                יישוב חדש
              </Link>
            </>
          )}
        </div>
      )}

      {/* Table */}
      {settlements.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" dir="rtl">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-right px-5 py-3 font-medium text-gray-500">שם יישוב</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500">אזור משלוח</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500">סטטוס</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {settlements.map((settlement) => {
                  // delivery_zones is a joined object (or null)
                  const zoneName =
                    settlement.delivery_zones &&
                    typeof settlement.delivery_zones === "object" &&
                    !Array.isArray(settlement.delivery_zones)
                      ? (settlement.delivery_zones as { name: string }).name
                      : null;

                  return (
                    <tr key={settlement.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="font-medium text-gray-900">{settlement.name}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        {zoneName ? (
                          <span className="inline-flex items-center h-6 px-2.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                            {zoneName}
                          </span>
                        ) : (
                          <span className="inline-flex items-center h-6 px-2.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                            ללא אזור
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={[
                            "inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold",
                            settlement.is_active
                              ? "bg-green-50 text-green-700"
                              : "bg-gray-100 text-gray-500",
                          ].join(" ")}
                        >
                          {settlement.is_active ? "פעיל" : "לא פעיל"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/settlements/${settlement.id}/edit`}
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 border border-transparent hover:border-gray-200 transition-colors"
                            aria-label={`ערוך יישוב ${settlement.name}`}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            עריכה
                          </Link>
                          <DeleteSettlementButton id={settlement.id} name={settlement.name} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
