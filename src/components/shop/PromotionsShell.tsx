"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { Search, X, ChevronDown, Tag } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Container } from "@/components/ui/Container";
import { ProductCard } from "@/components/shop/ProductCard";
import { CategoryHero } from "@/components/shop/CategoryHero";
import type { MockProduct } from "@/lib/data/mock";
import type { CategoryHeroConfig } from "@/lib/config/category-heroes";

type SortOption = "default" | "price-asc" | "price-desc" | "name";

const ITEMS_PER_STEP = 15;

function getDefaultPrice(product: MockProduct) {
  return (product.variants.find((v) => v.isDefault) ?? product.variants[0])?.priceAgorot ?? 0;
}

/**
 * Storefront shell for /promotions.
 *
 * Deliberately mirrors ParentCategoryShell — same grid, same product cards, same
 * search-and-sort toolbar — because /promotions is a virtual category rather
 * than a differently-shaped page. It has no subcategory tabs, and its empty
 * state explains that there simply are no live promotions right now.
 */
export function PromotionsShell({
  heroConfig,
  products,
}: {
  heroConfig: CategoryHeroConfig;
  products: MockProduct[];
}) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [visible, setVisible] = useState(ITEMS_PER_STEP);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    queueMicrotask(() => setVisible(ITEMS_PER_STEP));
  }, [products]);

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
    );
  }, [products, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortBy) {
      case "price-asc":  return arr.sort((a, b) => getDefaultPrice(a) - getDefaultPrice(b));
      case "price-desc": return arr.sort((a, b) => getDefaultPrice(b) - getDefaultPrice(a));
      case "name":       return arr.sort((a, b) => a.name.localeCompare(b.name, "he"));
      default:           return arr;
    }
  }, [filtered, sortBy]);

  const hasMore = visible < sorted.length;

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
  }, [hasMore, visible, sorted.length]);

  const isCatalogEmpty = products.length === 0;

  return (
    <div className="flex-1" style={{ backgroundColor: "var(--color-surface)" }}>
      <CategoryHero config={heroConfig} />

      <Container className="py-6 lg:py-8 !max-w-[1400px]">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-stone-400 mb-5" aria-label="breadcrumb">
          <Link href="/" className="hover:text-brand-700 transition-colors">דף הבית</Link>
          <span aria-hidden="true">/</span>
          <span className="text-gray-700 font-medium">מבצעים</span>
        </nav>

        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900">כל המוצרים במבצע</h2>
          <p className="mt-1 text-xs text-stone-400">
            * משקל המוצרים עשוי להיות מעט גבוה או נמוך מהטווח המוצג באתר.
          </p>
        </div>

        {/* Toolbar — hidden when there is nothing to filter */}
        {!isCatalogEmpty && (
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search
                className="absolute top-1/2 -translate-y-1/2 start-3.5 h-4 w-4 text-stone-400 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                inputMode="search"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setVisible(ITEMS_PER_STEP); }}
                placeholder="חפשו במבצעים..."
                aria-label="חיפוש במבצעים"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                className="w-full h-11 bg-white border border-stone-200 rounded-xl ps-10 pe-10 text-base md:text-sm text-gray-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
              />
              {search && (
                <button
                  onClick={() => { setSearch(""); setVisible(ITEMS_PER_STEP); }}
                  aria-label="נקה חיפוש"
                  className="absolute top-1/2 -translate-y-1/2 end-3 text-stone-400 hover:text-stone-700 cursor-pointer transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="relative shrink-0">
              <select
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value as SortOption); setVisible(ITEMS_PER_STEP); }}
                aria-label="מיון מוצרים"
                className="h-11 w-full sm:w-auto bg-white border border-stone-200 rounded-xl ps-4 pe-9 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer appearance-none min-w-[172px]"
              >
                <option value="default">מיון: ברירת מחדל</option>
                <option value="price-asc">מחיר: נמוך לגבוה</option>
                <option value="price-desc">מחיר: גבוה לנמוך</option>
                <option value="name">שם: א–ת</option>
              </select>
              <ChevronDown
                className="absolute top-1/2 -translate-y-1/2 end-3 h-4 w-4 text-stone-400 pointer-events-none"
                aria-hidden="true"
              />
            </div>
          </div>
        )}

        {search && sorted.length > 0 && (
          <p className="text-sm text-stone-500 mb-5">
            נמצאו <strong className="text-gray-800">{sorted.length}</strong> תוצאות עבור &quot;{search}&quot;
          </p>
        )}

        {sorted.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 lg:gap-4">
              {sorted.slice(0, visible).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            {hasMore && <div ref={sentinelRef} className="h-1 mt-4" aria-hidden="true" />}
          </>
        ) : (
          <EmptyState
            search={search}
            onClear={() => { setSearch(""); setVisible(ITEMS_PER_STEP); }}
          />
        )}
      </Container>
    </div>
  );
}

function EmptyState({ search, onClear }: { search: string; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center text-center py-20 px-4">
      <div className={cn("h-20 w-20 rounded-full flex items-center justify-center mb-5", "bg-red-50")}>
        <Tag className="h-9 w-9 text-red-400" aria-hidden="true" />
      </div>
      <h3 className="font-bold text-gray-900 text-lg mb-2">
        {search ? `לא נמצאו תוצאות עבור "${search}"` : "אין מבצעים פעילים כרגע"}
      </h3>
      <p className="text-sm text-stone-400 leading-relaxed mb-6 max-w-xs">
        {search
          ? "נסו מילות חיפוש שונות, או נקו את שדה החיפוש"
          : "המבצעים שלנו מתחלפים בכל שבוע. שווה לחזור ולבדוק בקרוב."}
      </p>
      {search ? (
        <button
          onClick={onClear}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-full hover:bg-brand-700 transition-colors cursor-pointer"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          נקו חיפוש
        </button>
      ) : (
        <Link
          href="/vegetables"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-full hover:bg-brand-700 transition-colors"
        >
          לעמוד הירקות
        </Link>
      )}
    </div>
  );
}
