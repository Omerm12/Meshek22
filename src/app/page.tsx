import { Suspense } from "react";

// ISR: rebuild the homepage at most once per 60 seconds.
// FeaturedCategories and BestSellers now use createPublicClient() (no cookies()),
// so Next.js can actually apply this cache — previously the cookies() call was
// forcing the page into dynamic rendering on every request.
export const revalidate = 60;
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { HeroSection } from "@/components/home/HeroSection";
import { TrustBar } from "@/components/home/TrustBar";
import { FeaturedCategories } from "@/components/home/FeaturedCategories";
import { BestSellers } from "@/components/home/BestSellers";
import { Promotions } from "@/components/home/Promotions";
import { HowItWorks } from "@/components/home/HowItWorks";
import { DeliveryAreas } from "@/components/home/DeliveryAreas";
import { WhyChooseUs } from "@/components/home/WhyChooseUs";
import { FinalCTA } from "@/components/home/FinalCTA";

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
        <Promotions />
        <HowItWorks />
        <DeliveryAreas />
        <WhyChooseUs />
        <FinalCTA />
      </main>

      <Footer />
    </>
  );
}
