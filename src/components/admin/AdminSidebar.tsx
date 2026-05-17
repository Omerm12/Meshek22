"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  Tag,
  ClipboardList,
  LogOut,
  ExternalLink,
  Truck,
  MapPin,
  X,
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import { useUser } from "@/store/user";

const NAV_ITEMS = [
  { href: "/admin",                  label: "לוח בקרה",    icon: LayoutDashboard, exact: true },
  { href: "/admin/orders",           label: "הזמנות",      icon: ClipboardList,   exact: false },
  { href: "/admin/products",         label: "מוצרים",      icon: ShoppingBag,     exact: false },
  { href: "/admin/categories",       label: "קטגוריות",    icon: Tag,             exact: false },
  { href: "/admin/delivery-zones",   label: "אזורי משלוח", icon: Truck,           exact: false },
  { href: "/admin/settlements",      label: "יישובים",     icon: MapPin,          exact: false },
];

interface AdminSidebarProps {
  adminName: string | null;
  adminEmail: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AdminSidebar({ adminName, adminEmail, isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useUser();

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
    router.refresh();
  };

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <aside
      className={cn(
        "w-60 shrink-0 flex flex-col bg-gray-900 min-h-screen overflow-y-auto",
        "fixed inset-y-0 right-0 z-30 transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "translate-x-full",
        "lg:relative lg:inset-auto lg:translate-x-0 lg:z-auto"
      )}
    >
      {/* Mobile close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-3 left-3 lg:hidden h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        aria-label="סגור תפריט"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>

      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-gray-800">
        <Image
          src="/images/heroes/logo.png"
          alt="משק 22"
          width={90}
          height={30}
          className="h-8 w-auto object-contain brightness-0 invert"
        />
        <p className="text-gray-500 text-xs">ניהול</p>
      </div>

      <nav className="px-3 py-4 flex flex-col gap-0.5" aria-label="ניווט ניהול">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                active
                  ? "bg-brand-600 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {label}
            </Link>
          );
        })}

        {/* Storefront link — sits directly after יישובים in the nav list */}
        <div className="mt-1 pt-1 border-t border-gray-800">
          <Link
            href="/"
            target="_blank"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
            חזרה לחנות
          </Link>
        </div>
      </nav>

      {/* User identity + logout — in normal document flow, not pinned */}
      <div className="px-3 pb-4 flex flex-col gap-1 border-t border-gray-800 pt-3">
        <div className="px-3 py-2.5">
          <p className="text-xs font-semibold text-white truncate">
            {adminName ?? adminEmail}
          </p>
          <p className="text-xs text-gray-500 truncate">{adminEmail}</p>
        </div>

        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-red-900/40 hover:text-red-400 transition-colors cursor-pointer w-full text-start"
          aria-label="יציאה מהחשבון"
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
          יציאה
        </button>
      </div>
    </aside>
  );
}
