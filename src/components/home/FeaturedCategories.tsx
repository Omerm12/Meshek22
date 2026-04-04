import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { CategoryCard } from "@/components/shop/CategoryCard";
import { fetchTopLevelCategories } from "@/lib/data/storefront";

export async function FeaturedCategories() {
  // Only show top-level parent categories (vegetables, fruits) on the homepage.
  // Child sub-categories are browsed from within their parent page.
  const categories = await fetchTopLevelCategories();

  if (categories.length === 0) return null;

  return (
    <section
      className="py-14 lg:py-20"
      style={{ backgroundColor: "var(--color-surface)" }}
      aria-labelledby="categories-title"
    >
      <Container>
        <div className="flex items-end justify-between mb-8 gap-4">
          <Reveal>
            <div>
              <p className="text-xs font-semibold text-brand-600 uppercase tracking-widest mb-2">
                קנו לפי קטגוריה
              </p>
              <h2 id="categories-title" className="text-3xl font-bold text-gray-900 sm:text-4xl">
                מה תרצו היום?
              </h2>
            </div>
          </Reveal>
          <a
            href="/vegetables"
            className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800 transition-colors shrink-0 pb-1"
          >
            לכל הקטגוריות
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
          {categories.map((cat, i) => (
            <Reveal key={cat.id} delay={i * 60}>
              <CategoryCard category={cat} />
            </Reveal>
          ))}
        </div>

        <div className="mt-5 sm:hidden text-center">
          <a
            href="/vegetables"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700"
          >
            לכל הקטגוריות
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </Container>
    </section>
  );
}
