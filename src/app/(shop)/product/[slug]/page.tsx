import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fetchProductBySlug, fetchProductsByCategory } from "@/lib/data/storefront";
import { ProductShell } from "@/components/shop/ProductShell";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await fetchProductBySlug(slug);
  return {
    title: product ? `${product.name} – ירקות ופירות טריים` : "מוצר",
    description: product?.description,
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const product = await fetchProductBySlug(slug);
  if (!product) notFound();

  const allInCategory = await fetchProductsByCategory(product.categorySlug);
  const related = allInCategory.filter((p) => p.id !== product.id).slice(0, 4);

  return <ProductShell product={product} relatedProducts={related} />;
}
