"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { SearchProductCard } from "@/components/layout/SearchProductCard";
import type { MockProduct } from "@/lib/data/mock";

// ─── Module-level catalog cache ───────────────────────────────────────────────
//
// Stored at module scope so it survives component re-mounts and is shared
// between the two NavbarSearch instances (desktop + mobile strip).
// On the first keystroke that reaches 2+ characters we fire exactly ONE fetch;
// every subsequent keystroke filters the cached array locally — effectively 0ms.

let _catalogCache: MockProduct[] | null = null;
let _loadPromise:  Promise<MockProduct[]> | null = null;

function loadCatalog(): Promise<MockProduct[]> {
  if (_catalogCache)  return Promise.resolve(_catalogCache);
  if (_loadPromise)   return _loadPromise;

  _loadPromise = fetch("/api/products/catalog")
    .then((r) => r.json() as Promise<MockProduct[]>)
    .then((data) => {
      _catalogCache = data;
      return data;
    })
    .catch(() => {
      _loadPromise = null; // allow retry on network error
      return [] as MockProduct[];
    });

  return _loadPromise;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface NavbarSearchProps {
  className?: string;
}

export function NavbarSearch({ className }: NavbarSearchProps) {
  const router        = useRouter();
  const containerRef  = useRef<HTMLDivElement>(null);
  const inputRef      = useRef<HTMLInputElement>(null);
  const latestQuery   = useRef("");           // guards against stale async results

  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState<MockProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);

  // Pre-warm the catalog on mount — by the time the user types the data is ready
  useEffect(() => { loadCatalog(); }, []);

  // Close dropdown on outside tap or click
  useEffect(() => {
    const close = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown",  close);
    document.addEventListener("touchstart", close, { passive: true });
    return () => {
      document.removeEventListener("mousedown",  close);
      document.removeEventListener("touchstart", close);
    };
  }, []);

  const handleChange = useCallback(async (value: string) => {
    latestQuery.current = value;
    setQuery(value);

    if (value.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    // Show spinner only while the catalog is first being fetched (one-time cost)
    if (!_catalogCache) setLoading(true);

    const catalog = await loadCatalog();

    // Discard if the user has since typed more characters
    if (latestQuery.current !== value) {
      setLoading(false);
      return;
    }

    setLoading(false);

    const q        = value.trim().toLowerCase();
    const filtered = catalog
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 6);

    setResults(filtered);
    setOpen(true);
  }, []);

  const navigateTo = useCallback((q: string) => {
    setOpen(false);
    setQuery("");
    router.push(`/products?q=${encodeURIComponent(q)}`);
  }, [router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigateTo(query.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
    }
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <form onSubmit={handleSubmit} role="search" aria-label="חיפוש מוצרים">
        <div className="relative">
          {loading ? (
            <Loader2
              className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-stone-400 animate-spin pointer-events-none"
              aria-hidden="true"
            />
          ) : (
            <Search
              className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-stone-400 pointer-events-none"
              aria-hidden="true"
            />
          )}
          {/*
            type="text" + inputMode="search":
              Prevents iOS Safari from rendering native search chrome (extra X button,
              rounded-rect styling) that would fight with our custom design.
            text-[16px] on mobile:
              iOS Safari zooms in when an input's font-size is < 16px. Using 16px on
              mobile and 14px (text-sm) on desktop prevents unwanted auto-zoom.
          */}
          <input
            ref={inputRef}
            type="text"
            inputMode="search"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (query.trim().length >= 2 && results.length > 0) setOpen(true);
            }}
            placeholder="חיפוש מוצרים..."
            aria-label="חיפוש מוצרים"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className={cn(
              "w-full h-10 md:h-9 rounded-full ps-9 pe-9",
              "bg-stone-50 border border-stone-200",
              "text-[16px] md:text-sm text-gray-900 placeholder:text-stone-400",
              "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent focus:bg-white",
              "transition-all duration-200",
            )}
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="נקה חיפוש"
              className="absolute top-1/2 -translate-y-1/2 end-1.5 flex items-center justify-center h-7 w-7 rounded-full text-stone-400 hover:text-stone-600 active:bg-stone-100 transition-colors touch-manipulation"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </form>

      {/* ── Results dropdown ─────────────────────────────────────────────── */}
      {open && (
        <div
          className={cn(
            "absolute top-full mt-2 inset-x-0 max-w-full",
            "bg-white rounded-2xl border border-stone-100/80",
            "shadow-[0_8px_30px_-4px_rgba(0,0,0,0.12),0_2px_8px_-2px_rgba(0,0,0,0.06)]",
            "overflow-hidden z-50 animate-fade-in",
          )}
          role="listbox"
          aria-label="תוצאות חיפוש"
        >
          {results.length > 0 ? (
            <>
              {/* Scrollable product card list */}
              <ul
                className="overscroll-contain overflow-y-auto"
                style={{ maxHeight: "min(380px, 60vh)" }}
              >
                {results.map((product) => (
                  <li key={product.id} role="option" aria-selected={false}>
                    <SearchProductCard
                      product={product}
                      onNavigate={navigateTo}
                    />
                  </li>
                ))}
              </ul>

              {/* Footer: navigate to full results page */}
              <div className="border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => navigateTo(query.trim())}
                  className="flex items-center justify-center gap-2 w-full min-h-[44px] px-4 py-2.5 text-sm text-brand-600 font-medium hover:bg-brand-50 active:bg-brand-100 transition-colors touch-manipulation"
                >
                  <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    כל התוצאות עבור &quot;{query}&quot;
                  </span>
                </button>
              </div>
            </>
          ) : (
            <div className="px-4 py-5 text-sm text-stone-400 text-center">
              לא נמצאו תוצאות עבור &quot;{query}&quot;
            </div>
          )}
        </div>
      )}
    </div>
  );
}
