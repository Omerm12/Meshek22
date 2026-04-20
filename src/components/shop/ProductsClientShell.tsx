"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { ProductCard } from "@/components/shop/ProductCard";
import type { MockProduct } from "@/lib/data/mock";

// 5 columns × 3 rows = 15 initial items; load in full-row chunks (3 rows = 15)
const ITEMS_PER_STEP = 15;

interface ProductsClientShellProps {
  products:   MockProduct[];
  totalCount: number;
}

export function ProductsClientShell({ products }: ProductsClientShellProps) {
  const [search, setSearch]   = useState("");
  const [visible, setVisible] = useState(ITEMS_PER_STEP);
  const sentinelRef           = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
    );
  }, [products, search]);

  const hasMore = visible < filtered.length;

  function handleSearchChange(value: string) {
    setSearch(value);
    setVisible(ITEMS_PER_STEP);
  }

  // Infinite scroll — 'visible' intentionally excluded from deps to prevent
  // the observer from re-attaching (and potentially double-firing) on every load.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          setTimeout(() => setVisible((v) => v + ITEMS_PER_STEP), 200);
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, visible, filtered.length]);

  const displayed = filtered.slice(0, visible);

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

      {/* Product grid — 5 columns on large screens */}
      {displayed.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {displayed.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {/* Infinite scroll sentinel */}
          {hasMore && (
            <div ref={sentinelRef} className="h-1 mt-4" aria-hidden="true" />
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
