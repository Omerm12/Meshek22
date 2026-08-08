import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { Plus, Tag, Pencil, ChevronLeft } from "lucide-react";
import { AdminSearchInput } from "@/components/admin/AdminSearchInput";
import { createAdminClient } from "@/lib/supabase/server";
import { DeleteCategoryButton } from "@/components/admin/categories/DeleteCategoryButton";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { ADMIN_BASE_PATH } from "@/lib/admin/routes";

export const metadata: Metadata = { title: "קטגוריות" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

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

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function AdminCategoriesPage({ searchParams }: PageProps) {

  const { q: rawQ, page: rawPage } = await searchParams;
  const q = rawQ?.trim() ?? "";
  const page = Math.max(1, Number(rawPage ?? "1") || 1);

  const supabase = await createAdminClient();

  if (q) {
    // Search mode: flat list of all matching categories, no pagination needed
    const { data: categories, error } = await supabase
      .from("categories")
      .select("id, name, slug, description, sort_order, is_active, parent_id, parent:parent_id(id, name)")
      .ilike("name", `%${q}%`)
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

    return (
      <CategoriesLayout q={q} totalCount={cats.length} page={1} totalPages={1} showingAll>
        {cats.length === 0 ? (
          <EmptySearch q={q} />
        ) : (
          <CategoriesTable cats={cats} flat />
        )}
      </CategoriesLayout>
    );
  }

  // Normal mode: paginate top-level categories, show children inline.
  //
  // These three reads do not depend on each other, so they are issued together.
  // Only the children query genuinely depends on the page's ids, so the page now
  // costs two sequential stages instead of four (~2.3 s → ~0.7 s measured).
  const [{ count: topLevelCount }, topLevelResult, { count: allCount }] = await Promise.all([
    supabase
      .from("categories")
      .select("id", { count: "exact", head: true })
      .is("parent_id", null),
    supabase
      .from("categories")
      .select("id, name, slug, description, sort_order, is_active, parent_id, parent:parent_id(id, name)")
      .is("parent_id", null)
      .order("sort_order", { ascending: true })
      .order("name",       { ascending: true })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    supabase.from("categories").select("id", { count: "exact", head: true }),
  ]);

  const { data: topLevelData, error: topLevelError } = topLevelResult;

  const totalCount = topLevelCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  if (topLevelError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700 text-sm">
        שגיאה בטעינת הקטגוריות. נסו לרענן את הדף.
      </div>
    );
  }

  const topLevel = (topLevelData ?? []) as unknown as CategoryRow[];
  const topLevelIds = topLevel.map((c) => c.id);

  // Fetch all children for this page's top-level categories
  const { data: childrenData } = topLevelIds.length > 0
    ? await supabase
        .from("categories")
        .select("id, name, slug, description, sort_order, is_active, parent_id, parent:parent_id(id, name)")
        .in("parent_id", topLevelIds)
        .order("sort_order", { ascending: true })
        .order("name",       { ascending: true })
    : { data: [] };

  const children = (childrenData ?? []) as unknown as CategoryRow[];
  const childrenByParent = new Map<string, CategoryRow[]>();
  for (const child of children) {
    if (!childrenByParent.has(child.parent_id!)) {
      childrenByParent.set(child.parent_id!, []);
    }
    childrenByParent.get(child.parent_id!)!.push(child);
  }

  const createPageUrl = (p: number) => {
    const params = new URLSearchParams();
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `${ADMIN_BASE_PATH}/categories${qs ? `?${qs}` : ""}`;
  };

  return (
    <CategoriesLayout q={q} totalCount={allCount ?? 0} page={safePage} totalPages={totalPages}>
      {topLevel.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" dir="rtl">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-right px-4 py-3 font-medium text-gray-500">שם</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 hidden sm:table-cell">קטגוריה ראשית</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Slug</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 hidden md:table-cell">מיון</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">סטטוס</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {topLevel.map((cat) => (
                  <Fragment key={cat.id}>
                    <CategoryRow cat={cat} isChild={false} />
                    {(childrenByParent.get(cat.id) ?? []).map((child) => (
                      <CategoryRow key={child.id} cat={child} isChild parentName={cat.name} />
                    ))}
                  </Fragment>
                ))}
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
    </CategoriesLayout>
  );
}

// ── Layout wrapper ────────────────────────────────────────────────────────────

function CategoriesLayout({
  q,
  totalCount,
  children,
}: {
  q: string;
  totalCount: number;
  page: number;
  totalPages: number;
  showingAll?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">קטגוריות</h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalCount} קטגוריות{q ? " (תוצאות חיפוש)" : " במערכת"}
          </p>
        </div>
        <Link
          href={`${ADMIN_BASE_PATH}/categories/new`}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">קטגוריה חדשה</span>
          <span className="sm:hidden">חדשה</span>
        </Link>
      </div>

      {/* Live search */}
      <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4 mb-5">
        <AdminSearchInput
          defaultValue={q}
          placeholder="חיפוש לפי שם קטגוריה..."
        />
      </div>

      {children}
    </div>
  );
}

// ── Flat table (search mode) ──────────────────────────────────────────────────

function CategoriesTable({ cats, flat }: { cats: CategoryRow[]; flat?: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" dir="rtl">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="text-right px-4 py-3 font-medium text-gray-500">שם</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500 hidden sm:table-cell">קטגוריה ראשית</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Slug</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500 hidden md:table-cell">מיון</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">סטטוס</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cats.map((cat) => (
              <CategoryRow
                key={cat.id}
                cat={cat}
                isChild={!!cat.parent_id}
                parentName={cat.parent?.name}
                flat={flat}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Empty states ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
      <div className="h-14 w-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Tag className="h-7 w-7 text-gray-300" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-gray-900 mb-1">אין קטגוריות עדיין</p>
      <p className="text-sm text-gray-400 mb-5">צרו את הקטגוריה הראשונה</p>
      <Link
        href={`${ADMIN_BASE_PATH}/categories/new`}
        className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        קטגוריה חדשה
      </Link>
    </div>
  );
}

function EmptySearch({ q }: { q: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
      <div className="h-14 w-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Tag className="h-7 w-7 text-gray-300" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-gray-900 mb-1">לא נמצאו קטגוריות</p>
      <p className="text-sm text-gray-400 mb-4">אין תוצאות עבור &quot;{q}&quot;</p>
      <Link
        href={`${ADMIN_BASE_PATH}/categories`}
        className="inline-flex items-center gap-2 h-9 px-4 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
      >
        נקה חיפוש
      </Link>
    </div>
  );
}

// ── Row sub-component ─────────────────────────────────────────────────────────

function CategoryRow({
  cat,
  isChild,
  parentName,
  flat,
}: {
  cat: CategoryRow;
  isChild: boolean;
  parentName?: string;
  flat?: boolean;
}) {
  return (
    <tr className={["hover:bg-gray-50/50 transition-colors", isChild && !flat ? "bg-gray-50/30" : ""].join(" ")}>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          {isChild && !flat && (
            <ChevronLeft
              className="h-3.5 w-3.5 text-gray-300 shrink-0 rotate-180"
              aria-hidden="true"
            />
          )}
          <div>
            <span className={["font-medium text-gray-900", isChild && !flat ? "text-sm" : ""].join(" ")}>
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
      <td className="px-4 py-3.5 hidden sm:table-cell">
        {parentName ? (
          <span className="inline-flex items-center h-6 px-2.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
            {parentName}
          </span>
        ) : (
          <span className="text-xs text-gray-400">ראשית</span>
        )}
      </td>
      <td className="px-4 py-3.5 hidden lg:table-cell">
        <code
          className="text-xs bg-gray-100 px-2 py-0.5 rounded-md text-gray-600 font-mono"
          dir="ltr"
        >
          {cat.slug}
        </code>
      </td>
      <td className="px-4 py-3.5 text-gray-600 hidden md:table-cell">{cat.sort_order}</td>
      <td className="px-4 py-3.5">
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
      <td className="px-4 py-3.5">
        <div className="flex items-center justify-end gap-2">
          <Link
            href={`${ADMIN_BASE_PATH}/categories/${cat.id}/edit`}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 border border-transparent hover:border-gray-200 transition-colors"
            aria-label={`ערוך קטגוריה ${cat.name}`}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">עריכה</span>
          </Link>
          <DeleteCategoryButton id={cat.id} name={cat.name} />
        </div>
      </td>
    </tr>
  );
}
