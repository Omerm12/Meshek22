import type { Metadata } from "next";

/**
 * Outer administrator layout.
 *
 * Deliberately does NO authorization: it also wraps /meshek22-control/login,
 * and a guard here would redirect the login page to itself. The real gate lives
 * in (protected)/layout.tsx, which wraps every page except the login screen —
 * and each mutation Server Action re-checks authorization on its own regardless.
 */
export const metadata: Metadata = {
  title: {
    default: "ניהול | משק 22",
    template: "%s | ניהול משק 22",
  },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
