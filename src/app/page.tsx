import { Suspense } from "react";
import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { HeroSection } from "@/components/home/HeroSection";
import { TrustBar } from "@/components/home/TrustBar";
import { FeaturedCategories } from "@/components/home/FeaturedCategories";
import { BestSellers } from "@/components/home/BestSellers";
import { HowItWorks } from "@/components/home/HowItWorks";
import { FinalCTA } from "@/components/home/FinalCTA";

// ISR: rebuild the homepage at most once per 60 seconds.
// FeaturedCategories and BestSellers now use createPublicClient() (no cookies()),
// so Next.js can actually apply this cache — previously the cookies() call was
// forcing the page into dynamic rendering on every request.
export const revalidate = 60;

const SITE_URL = "https://meshek22.co.il";

/**
 * The existing logo, already served from /public — no copy or edit needed.
 * Absolute, because crawlers resolve Open Graph and JSON-LD URLs independently
 * of the page they were found on.
 */
const LOGO_URL = `${SITE_URL}/images/heroes/logo.png`;

/**
 * Homepage SEO.
 *
 * There was previously no Open Graph image and no structured data anywhere, so
 * Google had nothing to prefer and picked a product photo (the tomato) from the
 * page itself. Naming the logo explicitly gives it something authoritative to
 * use instead. No product or product image is touched.
 */
export const metadata: Metadata = {
  alternates: { canonical: `${SITE_URL}/` },
  openGraph: {
    type: "website",
    locale: "he_IL",
    siteName: "משק 22",
    url: `${SITE_URL}/`,
    title: "משק 22 – ירקות ופירות טריים",
    description:
      "ירקות, פירות ומוצרי טבע טריים ישירות מהמשק אל הבית שלך. הזמנה קלה, משלוח מהיר.",
    images: [
      {
        url: LOGO_URL,
        alt: "משק 22",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [LOGO_URL],
  },
};

/**
 * Organization structured data, with the logo as both `logo` and `image`.
 * `logo` is the property Google reads for the business avatar beside a result.
 */
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "משק 22",
  url: `${SITE_URL}/`,
  logo: LOGO_URL,
  image: LOGO_URL,
};

function CategoriesSkeleton() {
  return (
    <section
      className="py-14 lg:py-20"
      style={{ backgroundColor: "var(--color-surface)" }}
      aria-hidden="true"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-10 w-48 bg-stone-100 rounded-lg animate-pulse mb-8" />
        <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-2xl bg-stone-100 animate-pulse" />
          ))}
        </div>
      </div>
    </section>
  );
}

function BestSellersSkeleton() {
  return (
    <section
      className="py-16 lg:py-20"
      style={{ backgroundColor: "var(--color-surface-2)" }}
      aria-hidden="true"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-10 w-48 bg-stone-100 rounded-lg animate-pulse mb-8" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-stone-100 animate-pulse aspect-[3/4]" />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        // Static object built above — no user input, nothing to escape.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />

      <Header />

      <main id="main-content">
        <HeroSection />
        <TrustBar />
        <Suspense fallback={<CategoriesSkeleton />}>
          <FeaturedCategories />
        </Suspense>
        <Suspense fallback={<BestSellersSkeleton />}>
          <BestSellers />
        </Suspense>
        <HowItWorks />
        <FinalCTA />
      </main>

      <Footer />
    </>
  );
}
