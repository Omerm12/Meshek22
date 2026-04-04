import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { CategoryForm } from "@/components/admin/categories/CategoryForm";
import { createCategory } from "@/app/admin/categories/actions";

export const metadata: Metadata = { title: "קטגוריה חדשה" };

export default async function NewCategoryPage() {
  await requireAdmin();

  const supabase = await createAdminClient();
  // Only top-level categories can be parents
  const { data: topLevelCategories } = await supabase
    .from("categories")
    .select("id, name")
    .is("parent_id", null)
    .order("sort_order", { ascending: true })
    .order("name",       { ascending: true });

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-400 mb-5" aria-label="פירורי לחם">
        <Link href="/admin/categories" className="hover:text-gray-700 transition-colors">
          קטגוריות
        </Link>
        <ChevronRight className="h-3.5 w-3.5 rotate-180" aria-hidden="true" />
        <span className="text-gray-700 font-medium">חדשה</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">קטגוריה חדשה</h1>
        <p className="text-sm text-gray-500 mt-1">הוסיפו קטגוריה חדשה לחנות</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-xl">
        <CategoryForm
          action={createCategory}
          submitLabel="צרו קטגוריה"
          parentCategories={topLevelCategories ?? []}
        />
      </div>
    </div>
  );
}
