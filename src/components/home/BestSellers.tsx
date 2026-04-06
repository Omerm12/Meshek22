import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { ProductCarousel } from "@/components/ui/ProductCarousel";
import { fetchFeaturedProducts } from "@/lib/data/storefront";

export async function BestSellers() {
  const products = await fetchFeaturedProducts(12);

  if (products.length === 0) return null;

  return (
    <section
      id="best-sellers"
      className="py-16 lg:py-20"
      style={{ backgroundColor: "var(--color-surface-2)" }}
      aria-labelledby="bestsellers-title"
    >
      <Container>
        <div className="flex items-end justify-between mb-8 gap-4">
          <SectionTitle
            id="bestsellers-title"
            title="הנמכרים ביותר"
            subtitle="המוצרים שכולם אוהבים, טריים כל יום"
          />
          <Link
            href="/products"
            className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800 transition-colors shrink-0 pb-1"
          >
            כל המוצרים
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <ProductCarousel products={products} />

        <div className="mt-6 sm:hidden text-center">
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700"
          >
            לכל המוצרים
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </Container>
    </section>
  );
}
