"use client";

import Link from "next/link";
import { useUser } from "@/store/user";
import { useAuthModal } from "@/store/auth-modal";

const ACCOUNT_LINKS = [
  { label: "ההזמנות שלי", href: "/account/orders" },
  { label: "הפרופיל שלי", href: "/account" },
];

const LINK_CLASS = "text-sm text-stone-400 hover:text-brand-400 transition-colors";

export function FooterAccountLinks() {
  const { user } = useUser();
  const { openModal } = useAuthModal();

  return (
    <ul className="flex flex-col gap-2">
      {ACCOUNT_LINKS.map((l) =>
        user ? (
          <li key={l.href}>
            <Link href={l.href} className={LINK_CLASS}>
              {l.label}
            </Link>
          </li>
        ) : (
          <li key={l.href}>
            <button
              onClick={() => openModal()}
              className={`${LINK_CLASS} cursor-pointer`}
            >
              {l.label}
            </button>
          </li>
        )
      )}
    </ul>
  );
}
