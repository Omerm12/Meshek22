"use client";

import { useState, useMemo } from "react";
import { Search, X, ChevronDown } from "lucide-react";
import { ProductCard } from "@/components/shop/ProductCard";
import type { MockProduct } from "@/lib/data/mock";

const ITEMS_PER_STEP = 16; // 4 rows × 4 cols (lg breakpoint)

interface ProductsClientShellProps {
  products: MockProduct[];
  totalCount: number;
}

export function ProductsClientShell({ products, totalCount }: ProductsClientShellProps) {
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(ITEMS_PER_STEP);

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q),
    );
  }, [products, search]);

  const displayed = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;
  const remaining = filtered.length - visible;

  function handleSearchChange(value: string) {
    setSearch(value);
    setVisible(ITEMS_PER_STEP);
  }

  return (
    <>
      {/* Search bar */}
      <div className="relative mb-6 max-w-lg">
        <Search
          className="absolute top-1/2 -translate-y-1/2 start-3.5 h-4 w-4 text-stone-400 pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="חפשו מוצרים..."
          aria-label="חיפוש מוצרים"
          className="w-full h-11 bg-white border border-stone-200 rounded-xl ps-10 pe-10 text-sm text-gray-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
        />
        {search && (
          <button
            onClick={() => handleSearchChange("")}
            aria-label="נקה חיפוש"
            className="absolute top-1/2 -translate-y-1/2 end-3 text-stone-400 hover:text-stone-700 cursor-pointer transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Results count when searching */}
      {search && filtered.length > 0 && (
        <p className="text-sm text-stone-500 mb-5">
          נמצאו{" "}
          <strong className="text-gray-800">{filtered.length}</strong>{" "}
          תוצאות עבור &quot;{search}&quot;
        </p>
      )}

      {/* Product grid */}
      {displayed.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {displayed.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center mt-8">
              <button
                onClick={() => setVisible((v) => v + ITEMS_PER_STEP)}
                className="inline-flex items-center gap-2 h-11 px-8 rounded-full bg-white border border-stone-200 text-stone-700 font-medium text-sm hover:border-brand-400 hover:text-brand-700 hover:bg-brand-50 transition-all duration-200 cursor-pointer"
              >
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
                הצג עוד ({remaining} מוצרים נוספים)
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="py-24 text-center text-stone-400">
          {search ? (
            <>
              <p className="text-lg font-medium">
                לא נמצאו תוצאות עבור &quot;{search}&quot;
              </p>
              <button
                onClick={() => handleSearchChange("")}
                className="mt-4 text-sm text-brand-600 hover:underline cursor-pointer"
              >
                נקו חיפוש
              </button>
            </>
          ) : (
            <p className="text-lg font-medium">אין מוצרים להצגה כרגע</p>
          )}
        </div>
      )}
    </>
  );
}
