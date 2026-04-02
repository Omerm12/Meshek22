"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  Tag,
  ClipboardList,
  LogOut,
  Leaf,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useUser } from "@/store/user";

const NAV_ITEMS = [
  { href: "/admin",            label: "לוח בקרה",  icon: LayoutDashboard, exact: true },
  { href: "/admin/orders",     label: "הזמנות",    icon: ClipboardList,   exact: false },
  { href: "/admin/products",   label: "מוצרים",    icon: ShoppingBag,     exact: false },
  { href: "/admin/categories", label: "קטגוריות",  icon: Tag,             exact: false },
];

interface AdminSidebarProps {
  adminName: string | null;
  adminEmail: string;
}

export function AdminSidebar({ adminName, adminEmail }: AdminSidebarProps) {
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
    <aside className="w-60 shrink-0 flex flex-col bg-gray-900 min-h-screen">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-gray-800">
        <div className="h-8 w-8 rounded-xl bg-brand-600 flex items-center justify-center shrink-0">
          <Leaf className="h-4 w-4 text-white" aria-hidden="true" />
        </div>
        <div className="leading-tight">
          <p className="text-white font-bold text-sm">משק 22</p>
          <p className="text-gray-500 text-xs">ניהול</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5" aria-label="ניווט ניהול">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
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
      </nav>

      {/* Bottom: storefront link + user + logout */}
      <div className="px-3 pb-4 flex flex-col gap-1 border-t border-gray-800 pt-3">
        <Link
          href="/"
          target="_blank"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
          חזרה לחנות
        </Link>

        {/* Admin identity */}
        <div className="px-3 py-2.5 mt-1">
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
