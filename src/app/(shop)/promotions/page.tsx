import type { Metadata } from "next";
import { getCategoryHero } from "@/lib/config/category-heroes";
import { fetchPromotionalProducts } from "@/lib/data/storefront";
import { PromotionsShell } from "@/components/shop/PromotionsShell";

export const metadata: Metadata = {
  title: "מבצעים | משק 22",
  description:
    "כל המוצרים שנמצאים כרגע במבצע במשק 22 — מחירי מבצע, מבצעי כמות ומבצעים מעורבים.",
};

/**
 * /promotions — a dynamic virtual collection, not a real category.
 *
 * A product is listed here for exactly as long as it has at least one live
 * promotion (sale price, legacy quantity deal, or membership in a group
 * promotion). It keeps its own category at the same time: a fruit on promotion
 * still appears under פירות. When the last promotion is disabled, expires or is
 * deleted, the product leaves this page on the next revalidation with no manual
 * step. See fetchPromotionalProducts() for the exact rule.
 */
export const revalidate = 60;

export default async function PromotionsPage() {
  const products = await fetchPromotionalProducts();
  const heroConfig = getCategoryHero("sale");

  return <PromotionsShell heroConfig={heroConfig} products={products} />;
}
