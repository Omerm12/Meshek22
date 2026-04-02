import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Package, Pencil, Image as ImageIcon } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { DeleteProductButton } from "@/components/admin/products/DeleteProductButton";

export const metadata: Metadata = { title: "מוצרים" };
export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  await requireAdmin();

  const supabase = await createAdminClient();
  const { data: products, error } = await supabase
    .from("products")
    .select(`
      id, name, slug, image_url, is_active, is_featured, sort_order,
      categories ( id, name ),
      product_variants ( id )
    `)
    .order("sort_order", { ascending: true })
    .order("name",       { ascending: true });

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700 text-sm">
        שגיאה בטעינת המוצרים. נסו לרענן את הדף.
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">מוצרים</h1>
          <p className="text-sm text-gray-500 mt-1">{products.length} מוצרים במערכת</p>
        </div>
        <Link
          href="/admin/products/new"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          מוצר חדש
        </Link>
      </div>

      {/* Empty state */}
      {products.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="h-14 w-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Package className="h-7 w-7 text-gray-300" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-gray-900 mb-1">אין מוצרים עדיין</p>
          <p className="text-sm text-gray-400 mb-5">צרו את המוצר הראשון</p>
          <Link
            href="/admin/products/new"
            className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            מוצר חדש
          </Link>
        </div>
      )}

      {/* Table */}
      {products.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" dir="rtl">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-right px-5 py-3 font-medium text-gray-500">מוצר</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500">קטגוריה</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500">Slug</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500 hidden sm:table-cell">גרסאות</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500">סטטוס</th>
                  <th className="px-5 py-3" />
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
                      <td className="px-5 py-3.5">
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
                      <td className="px-5 py-3.5 text-gray-600">
                        {category?.name ?? <span className="text-gray-300">—</span>}
                      </td>

                      {/* Slug */}
                      <td className="px-5 py-3.5">
                        <code className="text-xs bg-gray-100 px-2 py-0.5 rounded-md text-gray-600 font-mono" dir="ltr">
                          {product.slug}
                        </code>
                      </td>

                      {/* Variant count */}
                      <td className="px-5 py-3.5 hidden sm:table-cell">
                        <span className="inline-flex items-center h-6 px-2 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          {variantCount} גרסאות
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
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
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/products/${product.id}/edit`}
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 border border-transparent hover:border-gray-200 transition-colors"
                            aria-label={`ערוך מוצר ${product.name}`}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            עריכה
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
        </div>
      )}
    </div>
  );
}
