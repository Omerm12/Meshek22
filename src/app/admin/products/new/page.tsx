import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/admin/products/ProductForm";
import { createProduct } from "@/app/admin/products/actions";
import type { CategoryOption } from "@/components/admin/products/ProductForm";

export const metadata: Metadata = { title: "מוצר חדש" };

export default async function NewProductPage() {
  await requireAdmin();

  const supabase = await createAdminClient();
  const { data: categories, error } = await supabase
    .from("categories")
    .select("id, name, parent_id")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name",       { ascending: true });

  if (error) notFound();

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-400 mb-5" aria-label="פירורי לחם">
        <Link href="/admin/products" className="hover:text-gray-700 transition-colors">
          מוצרים
        </Link>
        <ChevronRight className="h-3.5 w-3.5 rotate-180" aria-hidden="true" />
        <span className="text-gray-700 font-medium">חדש</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">מוצר חדש</h1>
        <p className="text-sm text-gray-500 mt-1">הוסיפו מוצר חדש לחנות</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-2xl">
        <ProductForm
          action={createProduct}
          submitLabel="צרו מוצר"
          categories={(categories ?? []) as CategoryOption[]}
        />
      </div>
    </div>
  );
}
