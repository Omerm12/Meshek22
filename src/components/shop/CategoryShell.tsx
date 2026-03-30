"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, ChevronDown, X, PackageOpen } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { ProductCard } from "@/components/shop/ProductCard";
import type { MockCategory, MockProduct } from "@/lib/data/mock";

type SortOption = "default" | "price-asc" | "price-desc" | "name";

interface CategoryShellProps {
  category: MockCategory;
  products: MockProduct[];
  allCategories: MockCategory[];
  currentSlug: string;
}

function getDefaultPrice(product: MockProduct) {
  return (product.variants.find((v) => v.isDefault) ?? product.variants[0]).priceAgorot;
}

export function CategoryShell({
  category,
  products,
  allCategories,
  currentSlug,
}: CategoryShellProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("default");

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  }, [products, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortBy) {
      case "price-asc":
        return arr.sort((a, b) => getDefaultPrice(a) - getDefaultPrice(b));
      case "price-desc":
        return arr.sort((a, b) => getDefaultPrice(b) - getDefaultPrice(a));
      case "name":
        return arr.sort((a, b) => a.name.localeCompare(b.name, "he"));
      default:
        return arr;
    }
  }, [filtered, sortBy]);

  return (
    <div className="flex-1" style={{ backgroundColor: "var(--color-surface)" }}>
      {/* ── Page header ── */}
      <div className="bg-white border-b border-stone-100">
        <Container className="py-6 lg:py-8">
          {/* Breadcrumb */}
          <nav
            className="flex items-center gap-1.5 text-sm text-stone-400 mb-5"
            aria-label="breadcrumb"
          >
            <Link href="/" className="hover:text-brand-700 transition-colors">
              דף הבית
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-gray-700 font-medium">{category.name}</span>
          </nav>

          {/* Category info */}
          <div className="flex items-center gap-4">
            <div
              className={`h-14 w-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 ${category.color}`}
              aria-hidden="true"
            >
              {category.icon}
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
                {category.name}
              </h1>
              <p className="text-stone-500 mt-0.5 text-sm">
                {category.description}
                <span className="text-stone-400"> · {products.length} מוצרים</span>
              </p>
            </div>
          </div>
        </Container>
      </div>

      {/* ── Category tabs ── */}
      <div className="bg-white border-b border-stone-100 overflow-x-auto">
        <Container>
          <div
            className="flex gap-2 py-3"
            style={{ minWidth: "max-content" }}
            role="navigation"
            aria-label="קטגוריות"
          >
            {allCategories.map((cat) => (
              <Link
                key={cat.id}
                href={`/category/${cat.slug}`}
                className={[
                  "flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium",
                  "transition-all duration-150 whitespace-nowrap",
                  cat.slug === currentSlug
                    ? "bg-brand-600 text-white shadow-sm"
                    : "bg-stone-100 text-stone-600 hover:bg-brand-50 hover:text-brand-700",
                ].join(" ")}
              >
                <span aria-hidden="true">{cat.icon}</span>
                {cat.name}
              </Link>
            ))}
          </div>
        </Container>
      </div>

      {/* ── Main content ── */}
      <Container className="py-6 lg:py-8">
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
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`חפשו ב${category.name}...`}
              aria-label={`חיפוש ב${category.name}`}
              className="w-full h-11 bg-white border border-stone-200 rounded-xl ps-10 pe-10 text-sm text-gray-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
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
              onChange={(e) => setSortBy(e.target.value as SortOption)}
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

        {/* Results info */}
        {search && sorted.length > 0 && (
          <p className="text-sm text-stone-500 mb-5">
            נמצאו{" "}
            <strong className="text-gray-800">{sorted.length}</strong>{" "}
            תוצאות עבור &quot;{search}&quot;
          </p>
        )}

        {/* Product grid */}
        {sorted.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
            {sorted.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <EmptyState
            search={search}
            categoryName={category.name}
            onClear={() => setSearch("")}
          />
        )}
      </Container>
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  search,
  categoryName,
  onClear,
}: {
  search: string;
  categoryName: string;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center py-20 px-4">
      <div className="h-20 w-20 rounded-full bg-stone-100 flex items-center justify-center mb-5">
        <PackageOpen className="h-9 w-9 text-stone-400" aria-hidden="true" />
      </div>
      <h3 className="font-bold text-gray-900 text-lg mb-2">
        {search
          ? `לא נמצאו תוצאות עבור "${search}"`
          : `אין עדיין מוצרים ב${categoryName}`}
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
