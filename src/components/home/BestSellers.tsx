import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { ProductCard } from "@/components/shop/ProductCard";
import { fetchFeaturedProducts } from "@/lib/data/storefront";

export async function BestSellers() {
  const products = await fetchFeaturedProducts(8);

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
          <a
            href="/category/yerakot"
            className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800 transition-colors shrink-0"
          >
            כל המוצרים
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        <div className="mt-8 sm:hidden text-center">
          <a
            href="/category/yerakot"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700"
          >
            לכל המוצרים
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </Container>
    </section>
  );
}
