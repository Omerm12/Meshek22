"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { Search, X, ChevronDown, PackageOpen } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Container } from "@/components/ui/Container";
import { ProductCard } from "@/components/shop/ProductCard";
import { CategoryHero } from "@/components/shop/CategoryHero";
import type { MockCategory, MockProduct } from "@/lib/data/mock";
import type { CategoryHeroConfig } from "@/lib/config/category-heroes";

// ─── Types ────────────────────────────────────────────────────────────────────

type SortOption = "default" | "price-asc" | "price-desc" | "name";

interface ParentCategoryShellProps {
  heroConfig:     CategoryHeroConfig;
  parentSlug:     string;
  subcategories:  MockCategory[];
  products:       MockProduct[];
  activeSubSlug:  string | null;
}

// 5 columns × 3 rows = 15 initial items; load in full-row chunks (3 rows = 15)
const ITEMS_PER_STEP = 15;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDefaultPrice(product: MockProduct) {
  return (product.variants.find((v) => v.isDefault) ?? product.variants[0])?.priceAgorot ?? 0;
}

// ─── Subcategory tabs ─────────────────────────────────────────────────────────

function SubcategoryTabs({
  parentSlug,
  subcategories,
  activeSlug,
  accentClass,
}: {
  parentSlug:    string;
  subcategories: MockCategory[];
  activeSlug:    string | null;
  accentClass:   string;
}) {
  return (
    <div className="bg-white border-b border-stone-100 overflow-x-auto">
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 max-w-[1400px]">
        <div
          className="flex gap-2 py-3"
          style={{ minWidth: "max-content" }}
          role="navigation"
          aria-label="תתי-קטגוריות"
        >
          <Link
            href={`/${parentSlug}`}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 whitespace-nowrap",
              !activeSlug
                ? cn(accentClass, "text-white shadow-sm")
                : "bg-stone-100 text-stone-600 hover:bg-brand-50 hover:text-brand-700"
            )}
          >
            הכל
          </Link>

          {subcategories.map((cat) => (
            <Link
              key={cat.id}
              href={`/${parentSlug}?sub=${cat.slug}`}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 whitespace-nowrap",
                activeSlug === cat.slug
                  ? cn(accentClass, "text-white shadow-sm")
                  : "bg-stone-100 text-stone-600 hover:bg-brand-50 hover:text-brand-700"
              )}
            >
              {cat.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ search, onClear }: { search: string; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center text-center py-20 px-4">
      <div className="h-20 w-20 rounded-full bg-stone-100 flex items-center justify-center mb-5">
        <PackageOpen className="h-9 w-9 text-stone-400" aria-hidden="true" />
      </div>
      <h3 className="font-bold text-gray-900 text-lg mb-2">
        {search ? `לא נמצאו תוצאות עבור "${search}"` : "אין עדיין מוצרים בקטגוריה זו"}
      </h3>
      <p className="text-sm text-stone-400 leading-relaxed mb-6 max-w-xs">
        {search
          ? "נסו מילות חיפוש שונות, או נקו את שדה החיפוש"
          : "חזרו אלינו בקרוב, המלאי מתחדש מדי שבוע"}
      </p>
      {search && (
        <button
          onClick={onClear}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-full hover:bg-brand-700 transition-colors cursor-pointer"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          נקו חיפוש
        </button>
      )}
    </div>
  );
}

// ─── Main shell ───────────────────────────────────────────────────────────────

export function ParentCategoryShell({
  heroConfig,
  parentSlug,
  subcategories,
  products,
  activeSubSlug,
}: ParentCategoryShellProps) {
  const [search, setSearch]   = useState("");
  const [sortBy, setSortBy]   = useState<SortOption>("default");
  const [visible, setVisible] = useState(ITEMS_PER_STEP);
  const sentinelRef           = useRef<HTMLDivElement>(null);

  // Reset visible count when the products prop changes (e.g. subcategory navigation).
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

  // Infinite scroll — sentinel below the grid triggers the next batch.
  // Deps: hasMore + sorted.length (re-register on filter/sort change).
  // 'visible' is intentionally NOT a dep — adding it would re-attach the observer
  // on every load, potentially double-firing while the sentinel is still in view.
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

  const activeSubCategory = activeSubSlug
    ? subcategories.find((c) => c.slug === activeSubSlug)
    : null;

  return (
    <div className="flex-1" style={{ backgroundColor: "var(--color-surface)" }}>
      {/* Hero */}
      <CategoryHero config={heroConfig} />

      {/* Subcategory tabs */}
      <SubcategoryTabs
        parentSlug={parentSlug}
        subcategories={subcategories}
        activeSlug={activeSubSlug}
        accentClass={heroConfig.accentClass}
      />

      {/* Main content */}
      <Container className="py-6 lg:py-8 !max-w-[1400px]">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-stone-400 mb-5" aria-label="breadcrumb">
          <Link href="/" className="hover:text-brand-700 transition-colors">דף הבית</Link>
          <span aria-hidden="true">/</span>
          <Link
            href={`/${parentSlug}`}
            className={cn(
              activeSubSlug
                ? "hover:text-brand-700 transition-colors"
                : "text-gray-700 font-medium"
            )}
          >
            {heroConfig.title}
          </Link>
          {activeSubCategory && (
            <>
              <span aria-hidden="true">/</span>
              <span className="text-gray-700 font-medium">{activeSubCategory.name}</span>
            </>
          )}
        </nav>

        {/* Product area */}
        <div>
          {/* Section heading */}
          <div className="flex items-baseline justify-between mb-4 gap-2">
            <h2 className="text-xl font-bold text-gray-900">
              {activeSubCategory ? activeSubCategory.name : `כל ה${heroConfig.title}`}
              <span className="text-base font-normal text-stone-400 me-2">
                {" "}({products.length} מוצרים)
              </span>
            </h2>
          </div>

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            {/* Search */}
            <div className="relative flex-1">
              <Search
                className="absolute top-1/2 -translate-y-1/2 start-3.5 h-4 w-4 text-stone-400 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setVisible(ITEMS_PER_STEP); }}
                placeholder={`חפשו ב${heroConfig.title}...`}
                aria-label={`חיפוש ב${heroConfig.title}`}
                className="w-full h-11 bg-white border border-stone-200 rounded-xl ps-10 pe-10 text-sm text-gray-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
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

            {/* Sort */}
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

          {/* Results count when searching */}
          {search && sorted.length > 0 && (
            <p className="text-sm text-stone-500 mb-5">
              נמצאו{" "}
              <strong className="text-gray-800">{sorted.length}</strong>{" "}
              תוצאות עבור &quot;{search}&quot;
            </p>
          )}

          {/* Product grid */}
          {sorted.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 lg:gap-4">
                {sorted.slice(0, visible).map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {/* Infinite scroll sentinel — observed by IntersectionObserver above */}
              {hasMore && (
                <div ref={sentinelRef} className="h-1 mt-4" aria-hidden="true" />
              )}
            </>
          ) : (
            <EmptyState search={search} onClear={() => { setSearch(""); setVisible(ITEMS_PER_STEP); }} />
          )}
        </div>
      </Container>
    </div>
  );
}
