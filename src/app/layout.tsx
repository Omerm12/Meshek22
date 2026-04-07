import type { Metadata, Viewport } from "next";
import { Rubik, Assistant } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/store/cart";
import { CartDrawer } from "@/components/layout/CartDrawer";
import { UserProvider } from "@/store/user";
import { AuthModalProvider } from "@/store/auth-modal";
import { AuthModalLoader } from "@/components/auth/AuthModalLoader";

const rubik = Rubik({
  subsets: ["hebrew", "latin"],
  variable: "--font-rubik",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const assistant = Assistant({
  subsets: ["hebrew", "latin"],
  variable: "--font-assistant",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "משק 22 – ירקות ופירות טריים",
    template: "%s | משק 22",
  },
  description:
    "ירקות, פירות ומוצרי טבע טריים ישירות מהמשק אל הבית שלך. הזמנה קלה, משלוח מהיר.",
  keywords: [
    "ירקות טריים",
    "פירות",
    "חנות ירקות",
    "קניית ירקות אונליין",
    "משלוח ירקות",
  ],
  authors: [{ name: "משק 22" }],
  openGraph: {
    type: "website",
    locale: "he_IL",
    siteName: "משק 22",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="he"
      dir="rtl"
      data-scroll-behavior="smooth"
      className={`${rubik.variable} ${assistant.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-[var(--color-surface)] text-gray-900 antialiased">
        <UserProvider>
          <AuthModalProvider>
            <CartProvider>
              {children}
              <CartDrawer />
              <AuthModalLoader />
            </CartProvider>
          </AuthModalProvider>
        </UserProvider>
      </body>
    </html>
  );
}
