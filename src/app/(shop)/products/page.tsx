import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { ProductsClientShell } from "@/components/shop/ProductsClientShell";
import { CategoryHero } from "@/components/shop/CategoryHero";
import { getCategoryHero } from "@/lib/config/category-heroes";
import { fetchAllProducts } from "@/lib/data/storefront";

export const metadata: Metadata = {
  title: "כל המוצרים | משק 22",
  description: "כל הירקות והפירות הטריים של משק 22 — קטיף יומי, משלוח מהיר.",
};

export const revalidate = 60;

export default async function ProductsPage() {
  const products = await fetchAllProducts();
  const heroConfig = getCategoryHero("products");

  return (
    <main className="min-h-screen" style={{ backgroundColor: "var(--color-surface)" }}>
      <CategoryHero config={heroConfig} />
      <Container className="py-10 lg:py-16">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-semibold text-brand-600 uppercase tracking-widest mb-2">
            החנות שלנו
          </p>
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            כל המוצרים
          </h1>
          {products.length > 0 && (
            <p className="mt-2 text-stone-500 text-sm">
              {products.length} מוצרים
            </p>
          )}
        </div>

        <ProductsClientShell products={products} totalCount={products.length} />
      </Container>
    </main>
  );
}
