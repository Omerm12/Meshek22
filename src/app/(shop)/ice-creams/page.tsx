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
  title: "גלידות – משק 22",
  description:
    "גלידות, ארטיקים וקינוחים קפואים – מגיעים קפואים עד הבית יחד עם שאר ההזמנה.",
};

const PARENT_SLUG = "ice-creams";

export default async function IceCreamsPage({
  searchParams,
}: {
  searchParams: Promise<{ sub?: string }>;
}) {
  const { sub } = await searchParams;
  const heroConfig = getCategoryHero(PARENT_SLUG);

  // גלידות is a flat category today, but the same shell handles subcategories
  // for free if the shop owner adds any later.
  const subcategories = await fetchChildCategoriesByParentSlug(PARENT_SLUG);

  const activeSubSlug =
    sub && subcategories.some((c) => c.slug === sub) ? sub : null;

  // Products appear here only once an administrator assigns them to גלידות
  // (or to one of its subcategories). Nothing is inferred or auto-populated.
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
