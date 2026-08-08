"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart, Menu, X, Phone, ChevronDown } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import { formatPrice } from "@/lib/utils/money";
import { useCart } from "@/store/cart";
import { Button } from "@/components/ui/Button";
import { PARENT_CATEGORY_NAV, SIMPLE_NAV_LINKS } from "@/lib/config/nav-categories";
import { NavbarSearch } from "@/components/layout/NavbarSearch";

export function Header() {
  const { totalItems, subtotalAgorot, openCart } = useCart();
  const pathname = usePathname();

  const [scrolled, setScrolled]             = useState(false);
  const [mobileOpen, setMobileOpen]         = useState(false);
  const [openDropdown, setOpenDropdown]     = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);

  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const dropdownRefs  = useRef<Map<string, HTMLDivElement>>(new Map());

  // ── Scroll ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── Close mobile on outside click ───────────────────────────────────────────
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mobileOpen]);

  // ── Body scroll lock ────────────────────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  // ── Active state helpers ─────────────────────────────────────────────────────
  const isCatActive = (href: string) => pathname === href || pathname.startsWith(href + "?");
  const isLinkActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 w-full transition-all duration-300",
          scrolled
            ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-stone-100"
            : "bg-white/80 backdrop-blur-sm",
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-[96px]">

            {/* ── Start group: Logo + Desktop Nav ───────────────────────────── */}
            <div className="flex items-center gap-1 shrink-0 min-w-0">
              {/* Logo */}
              <Link
                href="/"
                className="flex items-center shrink-0"
                aria-label="דף הבית"
              >
                <Image
                  src="/images/heroes/logo.png"
                  alt="משק 22"
                  width={180}
                  height={80}
                  className="h-[64px] lg:h-[80px] w-auto object-contain"
                  priority
                />
              </Link>

            {/* ── Desktop Nav ─────────────────────────────────────────────────
                Six entries now live here (four categories + מבצעים, אזורי משלוח,
                אודות), so the horizontal padding tightens on md/lg and relaxes
                again at xl. Nothing wraps or overflows down to 768px. ── */}
            <nav
              className="hidden md:flex items-center gap-0 lg:gap-0.5 min-w-0"
              aria-label="ניווט ראשי"
            >
              {/* Parent category nav — click navigates directly, hover shows subcategory dropdown */}
              {PARENT_CATEGORY_NAV.map((cat) => (
                <div
                  key={cat.slug}
                  ref={(el) => { if (el) dropdownRefs.current.set(cat.slug, el); }}
                  className="relative"
                  onMouseEnter={() => setOpenDropdown(cat.slug)}
                  onMouseLeave={() => setOpenDropdown(null)}
                >
                  <Link
                    href={cat.href}
                    className={cn(
                      "flex items-center px-2 lg:px-2.5 xl:px-3.5 py-2.5 rounded-lg whitespace-nowrap",
                      "text-[0.9375rem] xl:text-[1.0625rem] font-medium transition-all duration-150",
                      isCatActive(cat.href)
                        ? "text-brand-700 bg-brand-100 font-semibold"
                        : "text-stone-600 hover:text-brand-700 hover:bg-brand-50",
                    )}
                    aria-current={isCatActive(cat.href) ? "page" : undefined}
                  >
                    {cat.label}
                  </Link>

                  {/* Subcategory dropdown — centered under the parent button.
                      The outer div uses pt-2 (transparent padding) instead of mt-2 so
                      there is no gap between the trigger and panel: moving the mouse
                      through the transparent bridge area keeps the parent onMouseLeave
                      from firing, making the dropdown reliably hoverable. */}
                  {openDropdown === cat.slug && cat.children.length > 0 && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-56 pt-2 z-50">
                      <div
                        className="animate-dropdown-in bg-white rounded-2xl border border-stone-100/80 shadow-[0_8px_30px_-4px_rgba(0,0,0,0.12),0_2px_8px_-2px_rgba(0,0,0,0.06)] py-2 overflow-hidden"
                        role="menu"
                        aria-label={`תת-קטגוריות ${cat.label}`}
                      >
                        {cat.children.map((child) => (
                          <Link
                            key={child.slug}
                            href={child.href}
                            onClick={() => setOpenDropdown(null)}
                            className="block px-4 py-3 text-sm font-medium text-stone-600 hover:text-brand-700 hover:bg-brand-50/70 transition-colors duration-150"
                            role="menuitem"
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Simple links */}
              {SIMPLE_NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-2 lg:px-2.5 xl:px-4 py-2.5 rounded-lg whitespace-nowrap",
                    "text-[0.9375rem] xl:text-[1.0625rem] font-medium transition-all duration-150",
                    isLinkActive(link.href)
                      ? "text-brand-700 bg-brand-100 font-semibold"
                      : "text-stone-600 hover:text-brand-700 hover:bg-brand-50",
                  )}
                  aria-current={isLinkActive(link.href) ? "page" : undefined}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            </div>{/* ── end: Start group ── */}

            {/* ── Spacer ────────────────────────────────────────────────────── */}
            <div className="flex-1" />

            {/* ── End group: Desktop Search + Actions ───────────────────────── */}
            <div className="flex items-center gap-3">

              {/* Desktop search */}
              <NavbarSearch className="hidden lg:block w-44 xl:w-64" />

            {/* ── Actions ───────────────────────────────────────────────────── */}
            <div className="flex items-center gap-2">

              {/* Cart */}
              <button
                id="header-cart-btn"
                onClick={openCart}
                aria-label={`סל קניות – ${totalItems} פריטים`}
                className={cn(
                  "relative flex items-center gap-2 h-9 rounded-full transition-all duration-200 cursor-pointer",
                  totalItems > 0
                    ? "bg-brand-600 text-white px-3 shadow-sm hover:bg-brand-700"
                    : "text-stone-600 hover:text-brand-700 hover:bg-brand-50 px-2",
                )}
              >
                <ShoppingCart className="h-5 w-5" aria-hidden="true" />
                {totalItems > 0 && (
                  <>
                    <span className="text-sm font-semibold">
                      {formatPrice(subtotalAgorot)}
                    </span>
                    <span className="absolute -top-1 -end-1 h-5 w-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {totalItems > 9 ? "9+" : totalItems}
                    </span>
                  </>
                )}
              </button>

              {/* Mobile menu toggle */}
              <button
                onClick={() => setMobileOpen((v) => !v)}
                className="md:hidden h-9 w-9 flex items-center justify-center rounded-lg text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
                aria-label={mobileOpen ? "סגור תפריט" : "פתח תפריט"}
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
            </div>{/* ── end: End group ── */}
          </div>
        </div>
      </header>

      {/* ── Mobile / tablet search strip ─────────────────────────────────────────
          relative + z-[39]: establishes a stacking context above all auto-z-index
          page content (hero, sections) so the dropdown (z-50 within this context)
          correctly paints over the page. Without an explicit z-index the stacking
          context produced by backdrop-filter was at "auto" level — painted under
          page elements that come later in DOM order.
          bg-white (solid): backdrop-blur-sm was producing the stacking context that
          caused the z-index trap AND the iOS compositing layer that widened the
          layout on keyboard focus. Removed it. ── */}
      <div className="relative z-[39] lg:hidden bg-white border-b border-stone-100 px-4 sm:px-6 py-2.5">
        <NavbarSearch />
      </div>

      {/* ── Mobile overlay ───────────────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden"
          aria-hidden="true"
        />
      )}

      {/* ── Mobile menu panel ────────────────────────────────────────────────── */}
      <div
        ref={mobileMenuRef}
        className={cn(
          "fixed top-[96px] inset-x-0 z-40 bg-white border-b border-stone-100 shadow-lg md:hidden",
          "transition-all duration-300 ease-out overflow-hidden",
          mobileOpen ? "max-h-[82vh] opacity-100 overflow-y-auto" : "max-h-0 opacity-0",
        )}
        aria-label="תפריט מובייל"
      >
        <nav className="px-4 py-3 flex flex-col gap-0.5">

          {/* Parent categories — split: link navigates, chevron expands subcategories */}
          {PARENT_CATEGORY_NAV.map((cat) => (
            <div key={cat.slug}>
              <div className="flex items-stretch">
                <Link
                  href={cat.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex-1 flex items-center px-4 py-3 rounded-s-xl text-base font-medium transition-colors",
                    isCatActive(cat.href)
                      ? "text-brand-700 bg-brand-50 font-semibold"
                      : "text-stone-700 hover:bg-brand-50 hover:text-brand-700",
                  )}
                  aria-current={isCatActive(cat.href) ? "page" : undefined}
                >
                  {cat.label}
                </Link>
                {cat.children.length > 0 && (
                  <button
                    onClick={() =>
                      setMobileExpanded((prev) => (prev === cat.slug ? null : cat.slug))
                    }
                    className={cn(
                      "px-3 py-3 rounded-e-xl text-stone-400 hover:text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer",
                      mobileExpanded === cat.slug && "bg-brand-50 text-brand-700",
                    )}
                    aria-expanded={mobileExpanded === cat.slug}
                    aria-label={`הצג תת-קטגוריות של ${cat.label}`}
                  >
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        mobileExpanded === cat.slug ? "rotate-180" : "",
                      )}
                      aria-hidden="true"
                    />
                  </button>
                )}
              </div>

              {mobileExpanded === cat.slug && (
                <div className="ps-6 pb-1 flex flex-col gap-0.5">
                  {cat.children.map((child) => (
                    <Link
                      key={child.slug}
                      href={child.href}
                      onClick={() => setMobileOpen(false)}
                      className="block px-4 py-2.5 rounded-xl text-sm text-stone-600 hover:bg-brand-50 hover:text-brand-700 transition-colors"
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Simple links */}
          {SIMPLE_NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center px-4 py-3 rounded-xl text-base font-medium transition-colors",
                isLinkActive(link.href)
                  ? "text-brand-700 bg-brand-50 font-semibold"
                  : "text-stone-700 hover:bg-brand-50 hover:text-brand-700",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="px-4 pb-4">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => {
              setMobileOpen(false);
              openCart();
            }}
          >
            <ShoppingCart className="h-4 w-4" />
            לסל הקניות
            {totalItems > 0 && (
              <span className="mr-1 bg-white/30 rounded-full px-2 py-0.5 text-xs font-bold">
                {totalItems}
              </span>
            )}
          </Button>
        </div>

        <div className="border-t border-stone-100 px-4 py-3">
          <a href="tel:0508863030" className="flex items-center gap-2 text-sm text-stone-500">
            <Phone className="h-4 w-4 text-brand-500" />
            שירות לקוחות: 050-8863030
          </a>
        </div>
      </div>
    </>
  );
}
