import type { Metadata } from "next";
import { getCategoryHero } from "@/lib/config/category-heroes";
import {
  fetchChildCategoriesByParentSlug,
  fetchProductsByCategory,
  fetchProductsByParentCategorySlug,
} from "@/lib/data/storefront";
import { ParentCategoryShell } from "@/components/shop/ParentCategoryShell";

// Dynamic because rendering depends on the ?sub= search param.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ירקות טריים – משק 22",
  description:
    "ירקות איכותיים שנקטפו אתמול, מסופקים ישירות מהמשק לביתכם. בחירה יומית טרייה.",
};

const PARENT_SLUG = "vegetables";

export default async function VegetablesPage({
  searchParams,
}: {
  searchParams: Promise<{ sub?: string }>;
}) {
  const { sub } = await searchParams;
  const heroConfig = getCategoryHero(PARENT_SLUG);

  // Fetch subcategories first so we can validate the requested sub slug
  const subcategories = await fetchChildCategoriesByParentSlug(PARENT_SLUG);

  // Only use sub if it's a known child category slug
  const activeSubSlug =
    sub && subcategories.some((c) => c.slug === sub) ? sub : null;

  const products = activeSubSlug
    ? await fetchProductsByCategory(activeSubSlug)
    : await fetchProductsByParentCategorySlug(PARENT_SLUG);

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
