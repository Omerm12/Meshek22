import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MOCK_PRODUCTS } from "@/lib/data/mock";
import { ProductShell } from "@/components/shop/ProductShell";

// Pre-generate all known product slugs at build time
export function generateStaticParams() {
  return MOCK_PRODUCTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = MOCK_PRODUCTS.find((p) => p.slug === slug);
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

  const product = MOCK_PRODUCTS.find((p) => p.slug === slug);
  if (!product) notFound();

  // Up to 4 products from the same category, excluding this one
  const related = MOCK_PRODUCTS.filter(
    (p) => p.categorySlug === product.categorySlug && p.id !== product.id
  ).slice(0, 4);

  return <ProductShell product={product} relatedProducts={related} />;
}
