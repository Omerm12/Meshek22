"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  ShoppingCart,
  Menu,
  X,
  Phone,
  User,
  LogOut,
  ChevronDown,
  LayoutDashboard,
  Settings,
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import { formatPrice } from "@/lib/utils/money";
import { useCart } from "@/store/cart";
import { useUser } from "@/store/user";
import { useAuthModal } from "@/store/auth-modal";
import { Button } from "@/components/ui/Button";
import {
  PARENT_CATEGORY_NAV,
  SIMPLE_NAV_LINKS,
  ALL_PRODUCTS_LINK,
} from "@/lib/config/nav-categories";

export function Header() {
  const { totalItems, subtotalAgorot, openCart } = useCart();
  const { user, isLoading: authLoading, isAdmin, signOut } = useUser();
  const { openModal } = useAuthModal();
  const router = useRouter();
  const pathname = usePathname();

  const [scrolled, setScrolled]           = useState(false);
  const [mobileOpen, setMobileOpen]       = useState(false);
  const [openDropdown, setOpenDropdown]   = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);
  const [accountOpen, setAccountOpen]     = useState(false);

  const mobileMenuRef   = useRef<HTMLDivElement>(null);
  const accountRef      = useRef<HTMLDivElement>(null);
  const dropdownRefs    = useRef<Map<string, HTMLDivElement>>(new Map());

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

  // ── Close account dropdown on outside click ──────────────────────────────────
  useEffect(() => {
    if (!accountOpen) return;
    const handler = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [accountOpen]);

  // ── Body scroll lock ────────────────────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const handleSignOut = useCallback(async () => {
    setAccountOpen(false);
    await signOut();
    router.push("/");
    router.refresh();
  }, [signOut, router]);

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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-[84px]">

            {/* ── Logo ──────────────────────────────────────────────────────── */}
            <Link
              href="/"
              className="flex items-center"
              aria-label="דף הבית"
            >
              <Image
                src="/images/heroes/logo.png"
                alt="משק 22"
                width={200}
                height={68}
                className="h-[68px] object-contain"
                style={{ width: "auto" }}
                priority
              />
            </Link>

            {/* ── Desktop Nav ───────────────────────────────────────────────── */}
            <nav className="hidden md:flex items-center gap-0.5" aria-label="ניווט ראשי">

              {/* כל המוצרים */}
              <Link
                href={ALL_PRODUCTS_LINK.href}
                className={cn(
                  "px-4 py-2.5 rounded-lg text-base font-medium transition-all duration-150",
                  isLinkActive(ALL_PRODUCTS_LINK.href)
                    ? "text-brand-700 bg-brand-100 font-semibold"
                    : "text-stone-600 hover:text-brand-700 hover:bg-brand-50",
                )}
              >
                {ALL_PRODUCTS_LINK.label}
              </Link>

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
                      "flex items-center px-3.5 py-2.5 rounded-lg text-[0.9375rem] font-medium transition-all duration-150",
                      isCatActive(cat.href)
                        ? "text-brand-700 bg-brand-100 font-semibold"
                        : "text-stone-600 hover:text-brand-700 hover:bg-brand-50",
                    )}
                    aria-current={isCatActive(cat.href) ? "page" : undefined}
                  >
                    {cat.label}
                  </Link>

                  {/* Subcategory dropdown — centered under the parent button */}
                  {openDropdown === cat.slug && cat.children.length > 0 && (
                    <div
                      className="animate-dropdown-in absolute top-full mt-2 left-1/2 -translate-x-1/2 w-56 bg-white rounded-2xl border border-stone-100/80 shadow-[0_8px_30px_-4px_rgba(0,0,0,0.12),0_2px_8px_-2px_rgba(0,0,0,0.06)] py-2 z-50 overflow-hidden"
                      role="menu"
                      aria-label={`תת-קטגוריות ${cat.label}`}
                    >
                      {cat.children.map((child) => (
                        <Link
                          key={child.slug}
                          href={child.href}
                          onClick={() => setOpenDropdown(null)}
                          className="flex items-center gap-2.5 px-4 py-3 text-sm font-medium text-stone-600 hover:text-brand-700 hover:bg-brand-50/70 transition-colors duration-150"
                          role="menuitem"
                        >
                          {child.icon && (
                            <span className="text-base leading-none shrink-0" aria-hidden="true">
                              {child.icon}
                            </span>
                          )}
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
                  className={cn(
                    "px-4 py-2.5 rounded-lg text-base font-medium transition-all duration-150",
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

            {/* ── Actions ───────────────────────────────────────────────────── */}
            <div className="flex items-center gap-2">

              {/* Phone (desktop) */}
              <a
                href="tel:*3722"
                className="hidden lg:flex items-center gap-1.5 text-sm text-stone-500 hover:text-brand-700 transition-colors"
              >
                <Phone className="h-3.5 w-3.5" />
                <span>*3722</span>
              </a>

              {/* Auth area (desktop) */}
              <div className="hidden md:flex items-center gap-1">
                {authLoading ? (
                  <div className="h-9 w-24 rounded-full bg-stone-100 animate-pulse" aria-hidden="true" />
                ) : user ? (
                  /* ── Logged-in: account dropdown ── */
                  <div className="relative" ref={accountRef}>
                    <button
                      onClick={() => setAccountOpen((v) => !v)}
                      className={cn(
                        "flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-medium transition-colors cursor-pointer",
                        accountOpen
                          ? "text-brand-700 bg-brand-50"
                          : "text-stone-600 hover:text-brand-700 hover:bg-brand-50",
                      )}
                      aria-expanded={accountOpen}
                      aria-haspopup="menu"
                      aria-label="תפריט חשבון"
                    >
                      <User className="h-4 w-4" aria-hidden="true" />
                      <span className="hidden lg:inline">פרטי חשבון</span>
                      <ChevronDown
                        className={cn(
                          "h-3 w-3 transition-transform duration-200",
                          accountOpen ? "rotate-180" : "",
                        )}
                        aria-hidden="true"
                      />
                    </button>

                    {accountOpen && (
                      <div
                        className="absolute top-full mt-1.5 end-0 w-48 bg-white rounded-2xl shadow-xl border border-stone-100 py-2 z-50"
                        role="menu"
                        aria-label="אפשרויות חשבון"
                      >
                        <Link
                          href="/account"
                          onClick={() => setAccountOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-stone-700 hover:text-brand-700 hover:bg-brand-50 transition-colors"
                          role="menuitem"
                        >
                          <User className="h-4 w-4 shrink-0" aria-hidden="true" />
                          פרטי חשבון
                        </Link>

                        {isAdmin && (
                          <Link
                            href="/admin"
                            onClick={() => setAccountOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-stone-700 hover:text-brand-700 hover:bg-brand-50 transition-colors"
                            role="menuitem"
                          >
                            <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden="true" />
                            פורטל ניהול
                          </Link>
                        )}

                        <div className="border-t border-stone-100 my-1" />

                        <button
                          onClick={handleSignOut}
                          className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-stone-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          role="menuitem"
                        >
                          <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
                          התנתקות
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* ── Logged-out: single login button ── */
                  <button
                    onClick={() => openModal()}
                    className="flex items-center h-9 px-4 rounded-full text-sm font-semibold border border-stone-200 text-stone-700 hover:border-brand-400 hover:text-brand-700 transition-colors cursor-pointer"
                  >
                    כניסה לחשבון
                  </button>
                )}
              </div>

              {/* Cart */}
              <button
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
          </div>
        </div>
      </header>

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
          "fixed top-[84px] inset-x-0 z-40 bg-white border-b border-stone-100 shadow-lg md:hidden",
          "transition-all duration-300 ease-out overflow-hidden",
          mobileOpen ? "max-h-[82vh] opacity-100 overflow-y-auto" : "max-h-0 opacity-0",
        )}
        aria-label="תפריט מובייל"
      >
        <nav className="px-4 py-3 flex flex-col gap-0.5">

          {/* כל המוצרים */}
          <Link
            href={ALL_PRODUCTS_LINK.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center px-4 py-3 rounded-xl text-base font-medium transition-colors",
              isLinkActive(ALL_PRODUCTS_LINK.href)
                ? "text-brand-700 bg-brand-50 font-semibold"
                : "text-stone-700 hover:bg-brand-50 hover:text-brand-700",
            )}
          >
            {ALL_PRODUCTS_LINK.label}
          </Link>

          {/* Parent categories — split: link navigates, chevron expands subcategories */}
          {PARENT_CATEGORY_NAV.map((cat) => (
            <div key={cat.slug}>
              <div className="flex items-stretch">
                <Link
                  href={cat.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex-1 flex items-center gap-2.5 px-4 py-3 rounded-s-xl text-base font-medium transition-colors",
                    isCatActive(cat.href)
                      ? "text-brand-700 bg-brand-50 font-semibold"
                      : "text-stone-700 hover:bg-brand-50 hover:text-brand-700",
                  )}
                  aria-current={isCatActive(cat.href) ? "page" : undefined}
                >
                  <span aria-hidden="true">{cat.icon}</span>
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
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-stone-600 hover:bg-brand-50 hover:text-brand-700 transition-colors"
                    >
                      <span aria-hidden="true">{child.icon}</span>
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

        <div className="px-4 pb-4 flex flex-col gap-2">
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

          {authLoading ? (
            <div className="h-11 rounded-xl bg-stone-100 animate-pulse" aria-hidden="true" />
          ) : user ? (
            <div className="flex flex-col gap-1.5">
              <Link
                href="/account"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center gap-2 h-11 rounded-xl border border-stone-200 text-sm font-semibold text-stone-700 hover:border-brand-400 hover:text-brand-700 transition-colors"
              >
                <User className="h-4 w-4" aria-hidden="true" />
                פרטי חשבון
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-2 h-11 rounded-xl border border-brand-200 text-sm font-semibold text-brand-700 hover:bg-brand-50 transition-colors"
                >
                  <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                  פורטל ניהול
                </Link>
              )}
              <button
                onClick={() => { setMobileOpen(false); handleSignOut(); }}
                className="flex items-center justify-center gap-1.5 h-11 rounded-xl border border-stone-200 text-sm font-semibold text-stone-500 hover:border-red-200 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                aria-label="התנתקות"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                התנתקות
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setMobileOpen(false); openModal(); }}
              className="flex items-center justify-center h-11 rounded-xl border border-stone-200 text-sm font-semibold text-stone-700 hover:border-brand-400 hover:text-brand-700 transition-colors w-full cursor-pointer"
            >
              כניסה לחשבון
            </button>
          )}
        </div>

        <div className="border-t border-stone-100 px-4 py-3">
          <a href="tel:*3722" className="flex items-center gap-2 text-sm text-stone-500">
            <Phone className="h-4 w-4 text-brand-500" />
            שירות לקוחות: *3722
          </a>
        </div>
      </div>
    </>
  );
}
