import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fetchCategories, fetchProductsByCategory } from "@/lib/data/storefront";
import { CategoryShell } from "@/components/shop/CategoryShell";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const allCategories = await fetchCategories();
  const category = allCategories.find((c) => c.slug === slug);
  return {
    title: category ? `${category.name} – ירקות ופירות טריים` : "קטגוריה",
    description: category?.description,
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [allCategories, products] = await Promise.all([
    fetchCategories(),
    fetchProductsByCategory(slug),
  ]);

  const category = allCategories.find((c) => c.slug === slug);
  if (!category) notFound();

  return (
    <CategoryShell
      category={category}
      products={products}
      allCategories={allCategories}
      currentSlug={slug}
    />
  );
}
