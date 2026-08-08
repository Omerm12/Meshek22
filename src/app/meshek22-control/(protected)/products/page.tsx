import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Package, Pencil, Image as ImageIcon } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { DeleteProductButton } from "@/components/admin/products/DeleteProductButton";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminSearchInput } from "@/components/admin/AdminSearchInput";
import { ADMIN_BASE_PATH } from "@/lib/admin/routes";

export const metadata: Metadata = { title: "מוצרים" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function AdminProductsPage({ searchParams }: PageProps) {

  const { q: rawQ, page: rawPage } = await searchParams;
  const q = rawQ?.trim() ?? "";
  const page = Math.max(1, Number(rawPage ?? "1") || 1);

  const supabase = await createAdminClient();

  // Count and page data are independent, so they are issued together. Awaiting
  // the count first cost a full extra round-trip (~350 ms measured) on every
  // visit; the requested page is used directly and only clamped afterwards.
  let countQ = supabase.from("products").select("id", { count: "exact", head: true });
  if (q) countQ = countQ.ilike("name", `%${q}%`);

  let dataQ = supabase
    .from("products")
    .select(`
      id, name, slug, image_url, is_active, is_featured, sort_order,
      categories ( id, name ),
      product_variants ( id )
    `)
    .order("sort_order", { ascending: true })
    .order("name",       { ascending: true });
  if (q) dataQ = dataQ.ilike("name", `%${q}%`);
  dataQ = dataQ.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const [{ count }, { data: products, error }] = await Promise.all([countQ, dataQ]);

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700 text-sm">
        שגיאה בטעינת המוצרים. נסו לרענן את הדף.
      </div>
    );
  }

  const createPageUrl = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `${ADMIN_BASE_PATH}/products${qs ? `?${qs}` : ""}`;
  };

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">מוצרים</h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalCount} מוצרים{q ? " (מסוננים)" : " במערכת"}
          </p>
        </div>
        <Link
          href={`${ADMIN_BASE_PATH}/products/new`}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">מוצר חדש</span>
          <span className="sm:hidden">חדש</span>
        </Link>
      </div>

      {/* Live search */}
      <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4 mb-5">
        <AdminSearchInput
          defaultValue={q}
          placeholder="חיפוש לפי שם מוצר..."
        />
      </div>

      {/* Empty state */}
      {products.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="h-14 w-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Package className="h-7 w-7 text-gray-300" aria-hidden="true" />
          </div>
          {q ? (
            <>
              <p className="text-sm font-medium text-gray-900 mb-1">לא נמצאו מוצרים</p>
              <p className="text-sm text-gray-400">נסו מילת חיפוש אחרת</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-900 mb-1">אין מוצרים עדיין</p>
              <p className="text-sm text-gray-400 mb-5">צרו את המוצר הראשון</p>
              <Link
                href={`${ADMIN_BASE_PATH}/products/new`}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                מוצר חדש
              </Link>
            </>
          )}
        </div>
      )}

      {/* Table */}
      {products.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" dir="rtl">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-right px-4 py-3 font-medium text-gray-500">מוצר</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 hidden md:table-cell">קטגוריה</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Slug</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 hidden sm:table-cell">גרסאות</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">סטטוס</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((product) => {
                  const category = product.categories as unknown as { id: string; name: string } | null;
                  const variantCount = Array.isArray(product.product_variants)
                    ? product.product_variants.length
                    : 0;

                  return (
                    <tr key={product.id} className="hover:bg-gray-50/50 transition-colors">
                      {/* Name + image indicator */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={[
                              "h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
                              product.image_url ? "bg-brand-50" : "bg-gray-100",
                            ].join(" ")}
                            title={product.image_url ? "יש תמונה" : "אין תמונה"}
                          >
                            <ImageIcon
                              className={["h-3.5 w-3.5", product.image_url ? "text-brand-500" : "text-gray-300"].join(" ")}
                              aria-hidden="true"
                            />
                          </div>
                          <div>
                            <span className="font-medium text-gray-900">{product.name}</span>
                            {product.is_featured && (
                              <span className="ms-1.5 inline-flex items-center h-4 px-1.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700">
                                מומלץ
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3.5 text-gray-600 hidden md:table-cell">
                        {category?.name ?? <span className="text-gray-300">—</span>}
                      </td>

                      {/* Slug */}
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        <code className="text-xs bg-gray-100 px-2 py-0.5 rounded-md text-gray-600 font-mono" dir="ltr">
                          {product.slug}
                        </code>
                      </td>

                      {/* Variant count */}
                      <td className="px-4 py-3.5 hidden sm:table-cell">
                        <span className="inline-flex items-center h-6 px-2 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          {variantCount} גרסאות
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span
                          className={[
                            "inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold",
                            product.is_active
                              ? "bg-green-50 text-green-700"
                              : "bg-gray-100 text-gray-500",
                          ].join(" ")}
                        >
                          {product.is_active ? "פעיל" : "לא פעיל"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`${ADMIN_BASE_PATH}/products/${product.id}/edit`}
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 border border-transparent hover:border-gray-200 transition-colors"
                            aria-label={`ערוך מוצר ${product.name}`}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            <span className="hidden sm:inline">עריכה</span>
                          </Link>
                          <DeleteProductButton id={product.id} name={product.name} />
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
