import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MOCK_CATEGORIES, MOCK_PRODUCTS } from "@/lib/data/mock";
import { CategoryShell } from "@/components/shop/CategoryShell";

// Pre-generate all known category slugs at build time
export function generateStaticParams() {
  return MOCK_CATEGORIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = MOCK_CATEGORIES.find((c) => c.slug === slug);
  return {
    title: category
      ? `${category.name} – ירקות ופירות טריים`
      : "קטגוריה",
    description: category?.description,
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const category = MOCK_CATEGORIES.find((c) => c.slug === slug);
  if (!category) notFound();

  const products = MOCK_PRODUCTS.filter((p) => p.categorySlug === slug);

  return (
    <CategoryShell
      category={category}
      products={products}
      allCategories={MOCK_CATEGORIES}
      currentSlug={slug}
    />
  );
}
