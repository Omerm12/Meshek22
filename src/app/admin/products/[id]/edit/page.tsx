import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/admin/products/ProductForm";
import { updateProduct } from "@/app/admin/products/actions";
import type { ProductFormData, VariantFormData } from "@/lib/validations/admin-product";
import { VARIANT_UNITS } from "@/lib/validations/admin-product";

export const metadata: Metadata = { title: "עריכת מוצר" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id } = await params;

  const supabase = await createAdminClient();

  const [{ data: product, error: productError }, { data: categories, error: catError }] =
    await Promise.all([
      supabase
        .from("products")
        .select(`
          id, category_id, name, slug, description, image_url,
          is_active, is_featured, sort_order,
          product_variants (
            id, unit, label, price_agorot, compare_price_agorot,
            stock_quantity, is_available, is_default, sort_order
          )
        `)
        .eq("id", id)
        .single(),
      supabase
        .from("categories")
        .select("id, name")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name",       { ascending: true }),
    ]);

  if (productError || !product || catError) notFound();

  // Convert DB → form values (agorot → shekels for price fields)
  const rawVariants = Array.isArray(product.product_variants)
    ? product.product_variants
    : [];

  const variants: VariantFormData[] = rawVariants
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((v) => ({
      id:             v.id,
      unit:           VARIANT_UNITS.includes(v.unit as typeof VARIANT_UNITS[number])
                        ? (v.unit as typeof VARIANT_UNITS[number])
                        : "unit",
      label:          v.label,
      price:          v.price_agorot / 100,
      compare_price:  v.compare_price_agorot != null ? v.compare_price_agorot / 100 : null,
      stock_quantity: v.stock_quantity ?? null,
      is_available:   v.is_available,
      is_default:     v.is_default,
      sort_order:     v.sort_order,
    }));

  const defaultValues: ProductFormData = {
    category_id:  product.category_id,
    name:         product.name,
    slug:         product.slug,
    description:  product.description  ?? "",
    image_url:    product.image_url    ?? "",
    is_active:    product.is_active,
    is_featured:  product.is_featured,
    sort_order:   product.sort_order,
    variants,
  };

  const actionWithId = updateProduct.bind(null, product.id);

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-400 mb-5" aria-label="פירורי לחם">
        <Link href="/admin/products" className="hover:text-gray-700 transition-colors">
          מוצרים
        </Link>
        <ChevronRight className="h-3.5 w-3.5 rotate-180" aria-hidden="true" />
        <span className="text-gray-700 font-medium">{product.name}</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">עריכת מוצר</h1>
        <p className="text-sm text-gray-500 mt-1">
          עדכנו את פרטי המוצר{" "}
          <span className="font-medium text-gray-700">{product.name}</span>
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-2xl">
        <ProductForm
          defaultValues={defaultValues}
          action={actionWithId}
          submitLabel="שמרו שינויים"
          categories={categories ?? []}
        />
      </div>
    </div>
  );
}
