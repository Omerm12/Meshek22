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

export default function HomePage() {
  return (
    <>
      <Header />

      <main id="main-content">
        <HeroSection />
        <TrustBar />
        <FeaturedCategories />
        <BestSellers />
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
