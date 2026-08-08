import type { Metadata } from "next";
import Link from "next/link";
import { Plus, MapPin, Pencil } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { DeleteSettlementButton } from "@/components/admin/settlements/DeleteSettlementButton";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { SettlementsFiltersClient } from "@/components/admin/settlements/SettlementsFiltersClient";
import { ADMIN_BASE_PATH } from "@/lib/admin/routes";

export const metadata: Metadata = { title: "יישובים" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

export default async function AdminSettlementsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; zone?: string; page?: string }>;
}) {

  const { q, zone, page: rawPage } = await searchParams;
  const page = Math.max(1, Number(rawPage ?? "1") || 1);
  const qTrim = q?.trim() ?? "";
  const zoneTrim = zone?.trim() ?? "";

  const supabase = await createAdminClient();

  // Zones for dropdown
  const { data: zones } = await supabase
    .from("delivery_zones")
    .select("id, name")
    .order("name", { ascending: true });

  // Count query
  let countQ = supabase.from("settlements").select("id", { count: "exact", head: true });
  if (qTrim) countQ = countQ.ilike("name", `%${qTrim}%`);
  if (zoneTrim === "unassigned") countQ = countQ.is("delivery_zone_id", null);
  else if (zoneTrim) countQ = countQ.eq("delivery_zone_id", zoneTrim);
  const { count } = await countQ;

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  // Data query
  let dataQ = supabase
    .from("settlements")
    .select("id, name, is_active, delivery_zone_id, delivery_zones(name)")
    .order("name", { ascending: true });
  if (qTrim) dataQ = dataQ.ilike("name", `%${qTrim}%`);
  if (zoneTrim === "unassigned") dataQ = dataQ.is("delivery_zone_id", null);
  else if (zoneTrim) dataQ = dataQ.eq("delivery_zone_id", zoneTrim);
  dataQ = dataQ.range((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE - 1);

  const { data: settlements, error } = await dataQ;

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700 text-sm">
        שגיאה בטעינת היישובים. נסו לרענן את הדף.
      </div>
    );
  }

  const hasFilters = !!(qTrim || zoneTrim);

  const createPageUrl = (p: number) => {
    const params = new URLSearchParams();
    if (qTrim) params.set("q", qTrim);
    if (zoneTrim) params.set("zone", zoneTrim);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `${ADMIN_BASE_PATH}/settlements${qs ? `?${qs}` : ""}`;
  };

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">יישובים</h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalCount} יישובים
            {hasFilters ? " (מסוננים)" : " במערכת"}
          </p>
        </div>
        <Link
          href={`${ADMIN_BASE_PATH}/settlements/new`}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">יישוב חדש</span>
          <span className="sm:hidden">חדש</span>
        </Link>
      </div>

      {/* Live filters */}
      <SettlementsFiltersClient
        initialQ={qTrim}
        initialZone={zoneTrim}
        zones={zones ?? []}
      />

      {/* Empty state */}
      {settlements.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="h-14 w-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MapPin className="h-7 w-7 text-gray-300" aria-hidden="true" />
          </div>
          {hasFilters ? (
            <>
              <p className="text-sm font-medium text-gray-900 mb-1">לא נמצאו יישובים</p>
              <p className="text-sm text-gray-400 mb-4">נסו לשנות את פרמטרי הסינון</p>
              <Link
                href={`${ADMIN_BASE_PATH}/settlements`}
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
                href={`${ADMIN_BASE_PATH}/settlements/new`}
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
                  <th className="text-right px-4 py-3 font-medium text-gray-500">שם יישוב</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 hidden sm:table-cell">אזור משלוח</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">סטטוס</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {settlements.map((settlement) => {
                  const zoneName =
                    settlement.delivery_zones &&
                    typeof settlement.delivery_zones === "object" &&
                    !Array.isArray(settlement.delivery_zones)
                      ? (settlement.delivery_zones as { name: string }).name
                      : null;

                  return (
                    <tr key={settlement.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3.5">
                        <span className="font-medium text-gray-900">{settlement.name}</span>
                        {/* Zone badge shown inline on mobile */}
                        <span className="sm:hidden ms-2">
                          {zoneName ? (
                            <span className="inline-flex items-center h-5 px-2 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                              {zoneName}
                            </span>
                          ) : (
                            <span className="inline-flex items-center h-5 px-2 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                              ללא אזור
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 hidden sm:table-cell">
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
                      <td className="px-4 py-3.5">
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
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`${ADMIN_BASE_PATH}/settlements/${settlement.id}/edit`}
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 border border-transparent hover:border-gray-200 transition-colors"
                            aria-label={`ערוך יישוב ${settlement.name}`}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            <span className="hidden sm:inline">עריכה</span>
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

          <AdminPagination
            page={safePage}
            totalPages={totalPages}
            prevHref={safePage > 1 ? createPageUrl(safePage - 1) : null}
            nextHref={safePage < totalPages ? createPageUrl(safePage + 1) : null}
          />
        </div>
      )}
    </div>
  );
}
