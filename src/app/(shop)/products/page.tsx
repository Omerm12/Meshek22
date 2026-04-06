import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { ProductCard } from "@/components/shop/ProductCard";
import { fetchAllProducts } from "@/lib/data/storefront";

export const metadata: Metadata = {
  title: "כל המוצרים | משק 22",
  description: "כל הירקות והפירות הטריים של משק 22 — קטיף יומי, משלוח מהיר.",
};

export const revalidate = 60;

export default async function ProductsPage() {
  const products = await fetchAllProducts(60);

  return (
    <main className="min-h-screen" style={{ backgroundColor: "var(--color-surface)" }}>
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

        {/* Grid */}
        {products.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="py-24 text-center text-stone-400">
            <p className="text-lg font-medium">אין מוצרים להצגה כרגע</p>
            <p className="text-sm mt-1">נחזור בקרוב עם מוצרים חדשים!</p>
          </div>
        )}
      </Container>
    </main>
  );
}
