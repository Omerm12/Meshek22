"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, X, ChevronDown, PackageOpen } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Container } from "@/components/ui/Container";
import { ProductCard } from "@/components/shop/ProductCard";
import type { MockCategory, MockProduct } from "@/lib/data/mock";
import type { CategoryHeroConfig } from "@/lib/config/category-heroes";

// ─── Types ────────────────────────────────────────────────────────────────────

type SortOption = "default" | "price-asc" | "price-desc" | "name";

interface ParentCategoryShellProps {
  /** Config for the hero section (title, image, colors). */
  heroConfig:     CategoryHeroConfig;
  /** The parent category's slug (e.g. "vegetables"). */
  parentSlug:     string;
  /** All direct child categories. */
  subcategories:  MockCategory[];
  /** Products — already filtered server-side for the active subcategory or all. */
  products:       MockProduct[];
  /** The currently active subcategory slug, or null for "all". */
  activeSubSlug:  string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDefaultPrice(product: MockProduct) {
  return (product.variants.find((v) => v.isDefault) ?? product.variants[0])?.priceAgorot ?? 0;
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function CategoryHero({ config }: { config: CategoryHeroConfig }) {
  return (
    /*
     * The outer wrapper is `position: relative` so the overlay and text can
     * be absolutely positioned over the image.
     * The wrapper height is driven by the image itself (width:100%, height:auto)
     * — this is the ONLY way to guarantee the full image shows with zero cropping
     * regardless of the image's natural aspect ratio.
     * min-h-[280px] prevents a flash of zero-height before the image loads.
     */
    <div
      className="relative w-full overflow-hidden"
      style={{
        backgroundColor: config.containerBg,
        minHeight: "280px",
      }}
    >
      {/* Image — natural size, zero cropping */}
      {config.imageSrc && (
        <Image
          src={config.imageSrc}
          alt={config.imageAlt}
          width={1920}
          height={900}
          style={{ width: "100%", height: "auto", display: "block" }}
          priority
          aria-hidden="true"
        />
      )}

      {/* Full-area overlay for text legibility — absolutely covers the image */}
      <div className="absolute inset-0" style={{ backgroundColor: config.overlayColor }} aria-hidden="true" />

      {/* Bottom gradient — softens transition to page content */}
      <div
        className="absolute inset-x-0 bottom-0 h-20 pointer-events-none"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.25) 0%, transparent 100%)" }}
        aria-hidden="true"
      />

      {/* Text — absolutely centred over the image */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
        <h1
          className={cn("font-bold tracking-tight", config.headingColor)}
          style={{
            fontSize: "clamp(2.4rem, 5vw, 4rem)",
            lineHeight: 1.1,
            textShadow: "0 2px 20px rgba(0,0,0,0.6), 0 1px 4px rgba(0,0,0,0.4)",
          }}
        >
          {config.title}
        </h1>

        {config.subtitle && (
          <p
            className="text-white/90 leading-relaxed mt-4 max-w-sm"
            style={{
              fontSize: "clamp(0.95rem, 2vw, 1.1rem)",
              textShadow: "0 1px 10px rgba(0,0,0,0.55)",
              letterSpacing: "0.01em",
            }}
          >
            {config.subtitle}
          </p>
        )}
      </div>
    </div>
  );
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
  const allHref = `/${parentSlug}`;

  return (
    <div className="bg-white border-b border-stone-100 overflow-x-auto">
      <Container>
        <div
          className="flex gap-2 py-3"
          style={{ minWidth: "max-content" }}
          role="navigation"
          aria-label="תתי-קטגוריות"
        >
          {/* "All" tab */}
          <Link
            href={allHref}
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
              <span aria-hidden="true">{cat.icon}</span>
              {cat.name}
            </Link>
          ))}
        </div>
      </Container>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  search,
  onClear,
}: {
  search: string;
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
          : "אין עדיין מוצרים בקטגוריה זו"}
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

// ─── Sidebar filter (desktop) ─────────────────────────────────────────────────

function FilterSidebar({
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
    <aside className="hidden lg:block w-56 shrink-0">
      <div className="bg-white rounded-2xl border border-stone-100 p-4 sticky top-24">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">סנן לפי קטגוריה</h2>
        <ul className="flex flex-col gap-1">
          <li>
            <Link
              href={`/${parentSlug}`}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors",
                !activeSlug
                  ? cn(accentClass, "text-white font-medium")
                  : "text-stone-600 hover:bg-stone-50 hover:text-brand-700"
              )}
            >
              הכל
            </Link>
          </li>
          {subcategories.map((cat) => (
            <li key={cat.id}>
              <Link
                href={`/${parentSlug}?sub=${cat.slug}`}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors",
                  activeSlug === cat.slug
                    ? cn(accentClass, "text-white font-medium")
                    : "text-stone-600 hover:bg-stone-50 hover:text-brand-700"
                )}
              >
                <span className="text-base shrink-0" aria-hidden="true">{cat.icon}</span>
                <span className="leading-tight">{cat.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </aside>
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

  const activeSubCategory = activeSubSlug
    ? subcategories.find((c) => c.slug === activeSubSlug)
    : null;

  return (
    <div className="flex-1" style={{ backgroundColor: "var(--color-surface)" }}>
      {/* ── Hero ── */}
      <CategoryHero config={heroConfig} />

      {/* ── Mobile subcategory tabs ── */}
      <SubcategoryTabs
        parentSlug={parentSlug}
        subcategories={subcategories}
        activeSlug={activeSubSlug}
        accentClass={heroConfig.accentClass}
      />

      {/* ── Main content ── */}
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

        {/* Content + Sidebar layout (RTL: sidebar on right) */}
        <div className="flex gap-6 items-start">
          {/* Sidebar (desktop right side, start in RTL) */}
          <FilterSidebar
            parentSlug={parentSlug}
            subcategories={subcategories}
            activeSlug={activeSubSlug}
            accentClass={heroConfig.accentClass}
          />

          {/* Product area */}
          <div className="flex-1 min-w-0">
            {/* Section heading */}
            <div className="flex items-baseline justify-between mb-4 gap-2">
              <h2 className="text-lg font-bold text-gray-900">
                {activeSubCategory ? activeSubCategory.name : `כל ה${heroConfig.title}`}
                <span className="text-sm font-normal text-stone-400 me-2">
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
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`חפשו ב${heroConfig.title}...`}
                  aria-label={`חיפוש ב${heroConfig.title}`}
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

            {/* Results info when searching */}
            {search && sorted.length > 0 && (
              <p className="text-sm text-stone-500 mb-5">
                נמצאו{" "}
                <strong className="text-gray-800">{sorted.length}</strong>{" "}
                תוצאות עבור &quot;{search}&quot;
              </p>
            )}

            {/* Product grid */}
            {sorted.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
                {sorted.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <EmptyState search={search} onClear={() => setSearch("")} />
            )}
          </div>
        </div>
      </Container>
    </div>
  );
}
