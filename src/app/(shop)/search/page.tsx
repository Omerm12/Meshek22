import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { ProductsClientShell } from "@/components/shop/ProductsClientShell";
import { CategoryHero } from "@/components/shop/CategoryHero";
import { getCategoryHero } from "@/lib/config/category-heroes";
import { fetchAllProducts } from "@/lib/data/storefront";

export const metadata: Metadata = {
  title: "תוצאות חיפוש | משק 22",
  description: "חיפוש בכל המוצרים הטריים של משק 22 — קטיף יומי, משלוח מהיר.",
  robots: { index: false },
};

export const revalidate = 60;

/**
 * Search results page.
 *
 * The navbar search sends the visitor here with ?q=…; ProductsClientShell reads
 * the parameter and filters the catalog on the client, so typing stays instant.
 */
export default async function SearchPage() {
  const products = await fetchAllProducts();
  const heroConfig = getCategoryHero("search");

  return (
    <main className="min-h-screen" style={{ backgroundColor: "var(--color-surface)" }}>
      <CategoryHero config={heroConfig} />
      <Container className="py-6 lg:py-12">
        <div className="mb-6">
          <p className="text-xs font-semibold text-brand-600 uppercase tracking-widest mb-2">
            החנות שלנו
          </p>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">
            תוצאות חיפוש
          </h1>
          <p className="mt-1.5 text-xs text-stone-400">
            * משקל המוצרים עשוי להיות מעט גבוה או נמוך מהטווח המוצג באתר.
          </p>
        </div>

        <ProductsClientShell products={products} totalCount={products.length} />
      </Container>
    </main>
  );
}
