import { Container } from "@/components/ui/Container";

/**
 * Rendered by loading.tsx while a parent category page's server data resolves
 * (fetchParentCategoryPageData in src/lib/data/storefront.ts).
 *
 * Mirrors ParentCategoryShell's layout — hero strip, subcategory tabs, toolbar,
 * product grid — so nothing shifts when the real content swaps in, and so a
 * customer never sees the "אין מוצרים" empty state while products are still
 * loading: this skeleton is what shows instead.
 */
export function CategoryPageSkeleton() {
  return (
    <div className="flex-1" style={{ backgroundColor: "var(--color-surface)" }} aria-hidden="true">
      {/* Hero */}
      <div className="h-48 sm:h-64 bg-stone-100 animate-pulse" />

      {/* Subcategory tabs */}
      <div className="bg-white border-b border-stone-100">
        <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 max-w-[1400px]">
          <div className="flex gap-2 py-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-9 w-24 rounded-full bg-stone-100 animate-pulse" />
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <Container className="py-6 lg:py-8 !max-w-[1400px]">
        {/* Breadcrumb */}
        <div className="h-4 w-40 bg-stone-100 rounded animate-pulse mb-5" />

        {/* Section heading */}
        <div className="h-6 w-48 bg-stone-100 rounded animate-pulse mb-6" />

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="h-11 flex-1 bg-stone-100 rounded-xl animate-pulse" />
          <div className="h-11 w-full sm:w-[172px] bg-stone-100 rounded-xl animate-pulse" />
        </div>

        {/* Product grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 lg:gap-4">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-2xl bg-stone-100 animate-pulse" />
          ))}
        </div>
      </Container>
    </div>
  );
}
