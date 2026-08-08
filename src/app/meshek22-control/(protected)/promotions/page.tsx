import type { Metadata } from "next";
import Link from "next/link";
import { Percent, Plus } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { formatPrice } from "@/lib/utils/money";
import { isPromotionLive } from "@/lib/promotions/engine";
import { toPromotion } from "@/lib/data/promotions";
import { PromotionRowActions } from "@/components/admin/promotions/PromotionRowActions";

export const metadata: Metadata = { title: "מבצעים" };
// Promotions are live operational data — never served from a long cache.
export const dynamic = "force-dynamic";

function formatWindow(startsAt: string | null, endsAt: string | null): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });

  if (startsAt && endsAt) return `${fmt(startsAt)} – ${fmt(endsAt)}`;
  if (startsAt) return `מ־${fmt(startsAt)}`;
  if (endsAt) return `עד ${fmt(endsAt)}`;
  return "ללא הגבלת תאריך";
}

export default async function AdminPromotionsPage() {
  // Authorization is guaranteed by (protected)/layout.tsx, which already called
  // requireAdmin() for this request — no need to repeat it on the page.
  const db = createAdminClient();

  const { data } = await db
    .from("promotions")
    .select(
      "id, name, description, promotion_type, required_quantity, bundle_price_agorot, " +
        "is_active, starts_at, ends_at, sort_order, promotion_items ( product_variant_id )"
    )
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  const promotions = (data ?? []).map((row) =>
    toPromotion(row as unknown as Parameters<typeof toPromotion>[0])
  );

  const now = new Date();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">מבצעים</h1>
          <p className="text-sm text-gray-500 mt-1">
            מבצעי כמות מעורבים — כל N פריטים מתוך הקבוצה במחיר אחד
          </p>
        </div>
        <Link
          href={`${ADMIN_ROUTES.promotions}/new`}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          מבצע חדש
        </Link>
      </div>

      {promotions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 py-16 px-6 text-center">
          <div className="h-16 w-16 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-4">
            <Percent className="h-7 w-7 text-brand-500" aria-hidden="true" />
          </div>
          <h2 className="font-bold text-gray-900 mb-2">עדיין אין מבצעים</h2>
          <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto leading-relaxed">
            צרו מבצע כמות שיחול על מוצר אחד או על קבוצת מוצרים, לדוגמה: כל 4 גלידות ב־10 ₪.
          </p>
          <Link
            href={`${ADMIN_ROUTES.promotions}/new`}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            יצירת מבצע ראשון
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {promotions.map((promotion) => {
            const live = isPromotionLive(promotion, now);
            const scheduled = promotion.isActive && !live;

            return (
              <li
                key={promotion.id}
                className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <h2 className="font-bold text-gray-900 truncate">{promotion.name}</h2>
                      <span
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                          live
                            ? "bg-emerald-100 text-emerald-700"
                            : scheduled
                              ? "bg-amber-100 text-amber-700"
                              : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {live ? "פעיל עכשיו" : scheduled ? "מחוץ לטווח התאריכים" : "כבוי"}
                      </span>
                    </div>

                    <p className="text-sm text-gray-700">
                      כל <strong>{promotion.requiredQuantity}</strong> פריטים ב־
                      <strong>{formatPrice(promotion.bundlePriceAgorot)}</strong>
                    </p>

                    {promotion.description && (
                      <p className="text-sm text-gray-500 mt-1">{promotion.description}</p>
                    )}

                    <p className="text-xs text-gray-500 mt-2">
                      {promotion.eligibleVariantIds.length} וריאציות משתתפות ·{" "}
                      {formatWindow(promotion.startsAt, promotion.endsAt)}
                    </p>

                    <Link
                      href={`${ADMIN_ROUTES.promotions}/${promotion.id}/edit`}
                      className="inline-block mt-3 text-sm font-semibold text-brand-700 hover:text-brand-800 transition-colors"
                    >
                      עריכה
                    </Link>
                  </div>

                  <div className="shrink-0">
                    <PromotionRowActions
                      promotionId={promotion.id}
                      promotionName={promotion.name}
                      isActive={promotion.isActive}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
