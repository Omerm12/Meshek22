import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { CategoryForm } from "@/components/admin/categories/CategoryForm";
import { updateCategory } from "@/app/admin/categories/actions";

export const metadata: Metadata = { title: "עריכת קטגוריה" };

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id } = await params;

  const supabase = await createAdminClient();

  const [{ data: category, error }, { data: allTopLevel }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, slug, description, image_url, sort_order, is_active, parent_id")
      .eq("id", id)
      .single(),
    // Only top-level categories can be parents; exclude self
    supabase
      .from("categories")
      .select("id, name")
      .is("parent_id", null)
      .order("sort_order", { ascending: true })
      .order("name",       { ascending: true }),
  ]);

  if (error || !category) notFound();

  // Exclude self from parent options (prevent self-parenting)
  const parentCategories = (allTopLevel ?? []).filter((c) => c.id !== id);

  const actionWithId = updateCategory.bind(null, category.id);

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-400 mb-5" aria-label="פירורי לחם">
        <Link href="/admin/categories" className="hover:text-gray-700 transition-colors">
          קטגוריות
        </Link>
        <ChevronRight className="h-3.5 w-3.5 rotate-180" aria-hidden="true" />
        <span className="text-gray-700 font-medium">{category.name}</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">עריכת קטגוריה</h1>
        <p className="text-sm text-gray-500 mt-1">
          עדכנו את פרטי הקטגוריה{" "}
          <span className="font-medium text-gray-700">{category.name}</span>
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-xl">
        <CategoryForm
          defaultValues={{
            name:        category.name,
            slug:        category.slug,
            description: category.description ?? "",
            image_url:   category.image_url ?? "",
            sort_order:  category.sort_order,
            is_active:   category.is_active,
            parent_id:   category.parent_id ?? "",
          }}
          action={actionWithId}
          submitLabel="שמרו שינויים"
          parentCategories={parentCategories}
        />
      </div>
    </div>
  );
}
