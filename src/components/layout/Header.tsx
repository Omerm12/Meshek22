"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingCart, Menu, X, Leaf, Phone, User, LogOut, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatPrice } from "@/lib/utils/money";
import { useCart } from "@/store/cart";
import { useUser } from "@/store/user";
import { useAuthModal } from "@/store/auth-modal";
import { Button } from "@/components/ui/Button";
import { PARENT_CATEGORY_NAV, SIMPLE_NAV_LINKS } from "@/lib/config/nav-categories";

export function Header() {
  const { totalItems, subtotalAgorot, openCart } = useCart();
  const { user, isLoading: authLoading, signOut } = useUser();
  const { openModal } = useAuthModal();
  const router = useRouter();
  const [scrolled, setScrolled]         = useState(false);
  const [mobileOpen, setMobileOpen]     = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);

  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const dropdownRefs  = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on outside click
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

  // Close dropdown on outside click
  useEffect(() => {
    if (!openDropdown) return;
    const handler = (e: MouseEvent) => {
      const ref = dropdownRefs.current.get(openDropdown);
      if (ref && !ref.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openDropdown]);

  // Prevent body scroll when mobile menu open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const handleSignOut = async () => {
    await signOut();
    router.refresh();
  };

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
          <div className="flex items-center justify-between h-16">

            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-2 text-brand-700 hover:text-brand-800 transition-colors"
              aria-label="דף הבית"
            >
              <div className="h-8 w-8 bg-brand-600 rounded-xl flex items-center justify-center">
                <Leaf className="h-[18px] w-[18px] text-white" aria-hidden="true" />
              </div>
              <span className="font-bold text-xl tracking-tight">משק 22</span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1" aria-label="ניווט ראשי">

              {/* Parent category dropdowns */}
              {PARENT_CATEGORY_NAV.map((cat) => (
                <div
                  key={cat.slug}
                  ref={(el) => {
                    if (el) dropdownRefs.current.set(cat.slug, el);
                  }}
                  className="relative"
                >
                  <button
                    onClick={() =>
                      setOpenDropdown((prev) => (prev === cat.slug ? null : cat.slug))
                    }
                    onMouseEnter={() => setOpenDropdown(cat.slug)}
                    className={cn(
                      "flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer",
                      openDropdown === cat.slug
                        ? "text-brand-700 bg-brand-50"
                        : "text-stone-600 hover:text-brand-700 hover:bg-brand-50"
                    )}
                    aria-expanded={openDropdown === cat.slug}
                    aria-haspopup="menu"
                  >
                    <span aria-hidden="true">{cat.icon}</span>
                    {cat.label}
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 transition-transform duration-200",
                        openDropdown === cat.slug ? "rotate-180" : ""
                      )}
                      aria-hidden="true"
                    />
                  </button>

                  {/* Dropdown panel */}
                  {openDropdown === cat.slug && (
                    <div
                      onMouseLeave={() => setOpenDropdown(null)}
                      className="absolute top-full mt-1 end-0 w-56 bg-white rounded-2xl shadow-xl border border-stone-100 py-2 z-50"
                      role="menu"
                      aria-label={`תפריט ${cat.label}`}
                    >
                      {/* "All" link */}
                      <Link
                        href={cat.href}
                        onClick={() => setOpenDropdown(null)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50 transition-colors"
                        role="menuitem"
                      >
                        <span aria-hidden="true">{cat.icon}</span>
                        כל ה{cat.label}
                      </Link>
                      <div className="border-t border-stone-100 my-1.5" />

                      {/* Child links */}
                      {cat.children.map((child) => (
                        <Link
                          key={child.slug}
                          href={child.href}
                          onClick={() => setOpenDropdown(null)}
                          className="flex items-center gap-2.5 px-4 py-2 text-sm text-stone-600 hover:text-brand-700 hover:bg-brand-50 transition-colors"
                          role="menuitem"
                        >
                          <span className="text-base" aria-hidden="true">{child.icon}</span>
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
                  className="px-3 py-2 rounded-lg text-sm font-medium text-stone-600 hover:text-brand-700 hover:bg-brand-50 transition-all duration-150"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Actions */}
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
                  <div className="h-9 w-20 rounded-full bg-stone-100 animate-pulse" aria-hidden="true" />
                ) : user ? (
                  <>
                    <Link
                      href="/account"
                      className="flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-medium text-stone-600 hover:text-brand-700 hover:bg-brand-50 transition-colors"
                      aria-label="החשבון שלי"
                    >
                      <User className="h-4 w-4" aria-hidden="true" />
                      <span className="hidden lg:inline">החשבון שלי</span>
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-medium text-stone-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      aria-label="התנתקות"
                    >
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                      <span className="hidden lg:inline">התנתק</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => openModal()}
                    className="flex items-center h-9 px-4 rounded-full text-sm font-semibold border border-stone-200 text-stone-700 hover:border-brand-400 hover:text-brand-700 transition-colors cursor-pointer"
                  >
                    כניסה
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

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden"
          aria-hidden="true"
        />
      )}

      {/* Mobile menu panel */}
      <div
        ref={mobileMenuRef}
        className={cn(
          "fixed top-16 inset-x-0 z-40 bg-white border-b border-stone-100 shadow-lg md:hidden",
          "transition-all duration-300 ease-out overflow-hidden",
          mobileOpen ? "max-h-[80vh] opacity-100 overflow-y-auto" : "max-h-0 opacity-0",
        )}
        aria-label="תפריט מובייל"
      >
        <nav className="px-4 py-3 flex flex-col gap-1">

          {/* Parent categories with accordion */}
          {PARENT_CATEGORY_NAV.map((cat) => (
            <div key={cat.slug}>
              <button
                onClick={() =>
                  setMobileExpanded((prev) => (prev === cat.slug ? null : cat.slug))
                }
                className="flex items-center justify-between w-full px-4 py-3 rounded-xl text-base font-medium text-stone-700 hover:bg-brand-50 hover:text-brand-700 transition-colors cursor-pointer"
                aria-expanded={mobileExpanded === cat.slug}
              >
                <span className="flex items-center gap-2.5">
                  <span aria-hidden="true">{cat.icon}</span>
                  {cat.label}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-stone-400 transition-transform duration-200",
                    mobileExpanded === cat.slug ? "rotate-180" : ""
                  )}
                  aria-hidden="true"
                />
              </button>

              {mobileExpanded === cat.slug && (
                <div className="ps-6 pb-1 flex flex-col gap-0.5">
                  <Link
                    href={cat.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-brand-700 hover:bg-brand-50 transition-colors"
                  >
                    כל ה{cat.label}
                  </Link>
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
              className="flex items-center px-4 py-3 rounded-xl text-base font-medium text-stone-700 hover:bg-brand-50 hover:text-brand-700 transition-colors"
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
            <div className="flex gap-2">
              <Link
                href="/account"
                onClick={() => setMobileOpen(false)}
                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border border-stone-200 text-sm font-semibold text-stone-700 hover:border-brand-400 hover:text-brand-700 transition-colors"
              >
                <User className="h-4 w-4" aria-hidden="true" />
                החשבון שלי
              </Link>
              <button
                onClick={() => { setMobileOpen(false); handleSignOut(); }}
                className="flex items-center justify-center gap-1.5 h-11 px-4 rounded-xl border border-stone-200 text-sm font-semibold text-stone-500 hover:border-red-200 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                aria-label="התנתקות"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                התנתק
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setMobileOpen(false); openModal(); }}
              className="flex items-center justify-center h-11 rounded-xl border border-stone-200 text-sm font-semibold text-stone-700 hover:border-brand-400 hover:text-brand-700 transition-colors w-full cursor-pointer"
            >
              כניסה / הרשמה
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
