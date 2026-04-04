import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Tag, Pencil, ChevronLeft } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { DeleteCategoryButton } from "@/components/admin/categories/DeleteCategoryButton";

export const metadata: Metadata = { title: "קטגוריות" };
export const dynamic = "force-dynamic";

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  parent_id: string | null;
  parent: { id: string; name: string } | null;
};

export default async function AdminCategoriesPage() {
  await requireAdmin();

  const supabase = await createAdminClient();
  const { data: categories, error } = await supabase
    .from("categories")
    .select("id, name, slug, description, sort_order, is_active, parent_id, parent:parent_id(id, name)")
    .order("parent_id", { ascending: true, nullsFirst: true })
    .order("sort_order", { ascending: true })
    .order("name",       { ascending: true });

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700 text-sm">
        שגיאה בטעינת הקטגוריות. נסו לרענן את הדף.
      </div>
    );
  }

  const cats = (categories ?? []) as unknown as CategoryRow[];

  // Separate top-level and children for display
  const topLevel = cats.filter((c) => !c.parent_id);
  const children  = cats.filter((c) => c.parent_id);
  const childrenByParent = new Map<string, CategoryRow[]>();
  for (const child of children) {
    if (!childrenByParent.has(child.parent_id!)) {
      childrenByParent.set(child.parent_id!, []);
    }
    childrenByParent.get(child.parent_id!)!.push(child);
  }

  // Orphaned children (parent was deleted but child remains — defensive)
  const knownTopIds = new Set(topLevel.map((c) => c.id));
  const orphans = children.filter((c) => !knownTopIds.has(c.parent_id!));

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">קטגוריות</h1>
          <p className="text-sm text-gray-500 mt-1">
            {cats.length} קטגוריות במערכת · {topLevel.length} ראשיות · {children.length} תתי-קטגוריות
          </p>
        </div>
        <Link
          href="/admin/categories/new"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          קטגוריה חדשה
        </Link>
      </div>

      {/* Empty state */}
      {cats.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="h-14 w-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Tag className="h-7 w-7 text-gray-300" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-gray-900 mb-1">אין קטגוריות עדיין</p>
          <p className="text-sm text-gray-400 mb-5">צרו את הקטגוריה הראשונה</p>
          <Link
            href="/admin/categories/new"
            className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            קטגוריה חדשה
          </Link>
        </div>
      )}

      {/* Hierarchical table */}
      {cats.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" dir="rtl">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-right px-5 py-3 font-medium text-gray-500">שם</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500">קטגוריה ראשית</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500">Slug</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500">מיון</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500">סטטוס</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {/* Top-level categories first, each followed by its children */}
                {topLevel.map((cat) => (
                  <>
                    <CategoryRow key={cat.id} cat={cat} isChild={false} />
                    {(childrenByParent.get(cat.id) ?? []).map((child) => (
                      <CategoryRow key={child.id} cat={child} isChild parentName={cat.name} />
                    ))}
                  </>
                ))}

                {/* Orphaned children (defensive) */}
                {orphans.map((cat) => (
                  <CategoryRow key={cat.id} cat={cat} isChild parentName={cat.parent?.name ?? "—"} />
                ))}

                {/* Standalone categories that have no parent_id and no known children */}
                {children.filter((c) => !knownTopIds.has(c.parent_id!) && !orphans.includes(c)).map((cat) => (
                  <CategoryRow key={cat.id} cat={cat} isChild parentName={cat.parent?.name ?? "—"} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Row sub-component ─────────────────────────────────────────────────────────

function CategoryRow({
  cat,
  isChild,
  parentName,
}: {
  cat: CategoryRow;
  isChild: boolean;
  parentName?: string;
}) {
  return (
    <tr className={["hover:bg-gray-50/50 transition-colors", isChild ? "bg-gray-50/30" : ""].join(" ")}>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2">
          {isChild && (
            <ChevronLeft
              className="h-3.5 w-3.5 text-gray-300 shrink-0 rotate-180"
              aria-hidden="true"
            />
          )}
          <div>
            <span className={["font-medium text-gray-900", isChild ? "text-sm" : ""].join(" ")}>
              {cat.name}
            </span>
            {cat.description && (
              <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                {cat.description}
              </p>
            )}
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5">
        {parentName ? (
          <span className="inline-flex items-center h-6 px-2.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
            {parentName}
          </span>
        ) : (
          <span className="text-xs text-gray-400">ראשית</span>
        )}
      </td>
      <td className="px-5 py-3.5">
        <code
          className="text-xs bg-gray-100 px-2 py-0.5 rounded-md text-gray-600 font-mono"
          dir="ltr"
        >
          {cat.slug}
        </code>
      </td>
      <td className="px-5 py-3.5 text-gray-600">{cat.sort_order}</td>
      <td className="px-5 py-3.5">
        <span
          className={[
            "inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold",
            cat.is_active
              ? "bg-green-50 text-green-700"
              : "bg-gray-100 text-gray-500",
          ].join(" ")}
        >
          {cat.is_active ? "פעילה" : "לא פעילה"}
        </span>
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center justify-end gap-2">
          <Link
            href={`/admin/categories/${cat.id}/edit`}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 border border-transparent hover:border-gray-200 transition-colors"
            aria-label={`ערוך קטגוריה ${cat.name}`}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            עריכה
          </Link>
          <DeleteCategoryButton id={cat.id} name={cat.name} />
        </div>
      </td>
    </tr>
  );
}
