import type { Metadata } from "next";
import { getCategoryHero } from "@/lib/config/category-heroes";
import { fetchParentCategoryPageData } from "@/lib/data/storefront";
import { ParentCategoryShell } from "@/components/shop/ParentCategoryShell";

export const metadata: Metadata = {
  title: "פירות טריים – משק 22",
  description:
    "פירות עונתיים מובחרים, מתוקים ובשלים לשלמות. ישירות מהפרדסים לשולחנכם.",
};

const PARENT_SLUG = "fruits";

export default async function FruitsPage({
  searchParams,
}: {
  searchParams: Promise<{ sub?: string }>;
}) {
  const { sub } = await searchParams;
  const heroConfig = getCategoryHero(PARENT_SLUG);

  const { subcategories, activeSubSlug, products } =
    await fetchParentCategoryPageData(PARENT_SLUG, sub ?? null);

  return (
    <ParentCategoryShell
      heroConfig={heroConfig}
      parentSlug={PARENT_SLUG}
      subcategories={subcategories}
      products={products}
      activeSubSlug={activeSubSlug}
    />
  );
}
