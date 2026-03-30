"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, MapPin, ShoppingBag, LogOut } from "lucide-react";
import { useUser } from "@/store/user";

const NAV_ITEMS = [
  { href: "/account", label: "הפרופיל שלי", icon: User },
  { href: "/account/addresses", label: "כתובות משלוח", icon: MapPin },
  { href: "/account/orders", label: "ההזמנות שלי", icon: ShoppingBag },
];

export function AccountNav() {
  const pathname = usePathname();
  const { signOut } = useUser();

  return (
    <nav className="bg-white rounded-2xl border border-stone-100 p-2 flex flex-col gap-0.5">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={[
              "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
              active
                ? "bg-brand-50 text-brand-700"
                : "text-stone-600 hover:bg-stone-50 hover:text-gray-900",
            ].join(" ")}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {label}
          </Link>
        );
      })}

      <div className="border-t border-stone-100 mt-1 pt-1">
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-stone-500 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
          יציאה מהחשבון
        </button>
      </div>
    </nav>
  );
}
