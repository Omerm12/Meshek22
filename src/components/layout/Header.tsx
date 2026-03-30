"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ShoppingCart, Menu, X, Leaf, Phone, User } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatPrice } from "@/lib/utils/money";
import { useCart } from "@/store/cart";
import { useUser } from "@/store/user";
import { Button } from "@/components/ui/Button";

const NAV_LINKS = [
  { label: "ירקות ופירות", href: "/category/yerakot" },
  { label: "מבצעים", href: "/promotions" },
  { label: "אזורי משלוח", href: "#delivery-areas" },
  { label: "אודות", href: "#about" },
];

export function Header() {
  const { totalItems, subtotalAgorot, openCart } = useCart();
  const { user, isLoading: authLoading } = useUser();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on outside click
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(e.target as Node)
      ) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mobileOpen]);

  // Prevent body scroll when mobile menu open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 w-full transition-all duration-300",
          scrolled
            ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-stone-100"
            : "bg-white/80 backdrop-blur-sm"
        )}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Logo */}
            <a
              href="/"
              className="flex items-center gap-2 text-brand-700 hover:text-brand-800 transition-colors"
              aria-label="דף הבית"
            >
              <div className="h-8 w-8 bg-brand-600 rounded-xl flex items-center justify-center">
                <Leaf className="h-[18px] w-[18px] text-white" aria-hidden="true" />
              </div>
              <span className="font-bold text-xl tracking-tight">
                משק 22
              </span>
            </a>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1" aria-label="ניווט ראשי">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-stone-600 hover:text-brand-700 hover:bg-brand-50 transition-all duration-150"
                >
                  {link.label}
                </a>
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

              {/* Auth link (desktop) */}
              {!authLoading && (
                user ? (
                  <Link
                    href="/account"
                    className="hidden md:flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-medium text-stone-600 hover:text-brand-700 hover:bg-brand-50 transition-colors"
                    aria-label="החשבון שלי"
                  >
                    <User className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden lg:inline">החשבון שלי</span>
                  </Link>
                ) : (
                  <Link
                    href="/login"
                    className="hidden md:flex items-center h-9 px-4 rounded-full text-sm font-semibold border border-stone-200 text-stone-700 hover:border-brand-400 hover:text-brand-700 transition-colors"
                  >
                    כניסה
                  </Link>
                )
              )}

              {/* Cart */}
              <button
                onClick={openCart}
                aria-label={`סל קניות – ${totalItems} פריטים`}
                className={cn(
                  "relative flex items-center gap-2 h-9 rounded-full transition-all duration-200 cursor-pointer",
                  totalItems > 0
                    ? "bg-brand-600 text-white px-3 shadow-sm hover:bg-brand-700"
                    : "text-stone-600 hover:text-brand-700 hover:bg-brand-50 px-2"
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
                {mobileOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
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
          mobileOpen ? "max-h-[70vh] opacity-100" : "max-h-0 opacity-0"
        )}
        aria-label="תפריט מובייל"
      >
        <nav className="px-4 py-4 flex flex-col gap-1">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="flex items-center px-4 py-3 rounded-xl text-base font-medium text-stone-700 hover:bg-brand-50 hover:text-brand-700 transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="px-4 pb-4 flex flex-col gap-2">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => { setMobileOpen(false); openCart(); }}
          >
            <ShoppingCart className="h-4 w-4" />
            לסל הקניות
            {totalItems > 0 && (
              <span className="mr-1 bg-white/30 rounded-full px-2 py-0.5 text-xs font-bold">
                {totalItems}
              </span>
            )}
          </Button>
          {!authLoading && (
            user ? (
              <Link
                href="/account"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center gap-2 h-11 rounded-xl border border-stone-200 text-sm font-semibold text-stone-700 hover:border-brand-400 hover:text-brand-700 transition-colors"
              >
                <User className="h-4 w-4" aria-hidden="true" />
                החשבון שלי
              </Link>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center h-11 rounded-xl border border-stone-200 text-sm font-semibold text-stone-700 hover:border-brand-400 hover:text-brand-700 transition-colors"
              >
                כניסה / הרשמה
              </Link>
            )
          )}
        </div>

        <div className="border-t border-stone-100 px-4 py-3">
          <a
            href="tel:*3722"
            className="flex items-center gap-2 text-sm text-stone-500"
          >
            <Phone className="h-4 w-4 text-brand-500" />
            שירות לקוחות: *3722
          </a>
        </div>
      </div>
    </>
  );
}
