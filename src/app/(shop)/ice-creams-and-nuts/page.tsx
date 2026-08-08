import type { Metadata } from "next";
import { getCategoryHero } from "@/lib/config/category-heroes";
import { ICE_CREAMS_AND_NUTS_SLUG } from "@/lib/config/nav-categories";
import {
  fetchChildCategoriesByParentSlug,
  fetchProductsByCategory,
  fetchProductsByParentCategorySlug,
} from "@/lib/data/storefront";
import { ParentCategoryShell } from "@/components/shop/ParentCategoryShell";

// Dynamic because rendering depends on the ?sub= search param.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "גלידות ופיצוחים – משק 22",
  description:
    "משהו מתוק, משהו מלוח — גלידות, ארטיקים, אגוזים ופיצוחים, הכל בעמוד אחד ובמשלוח אחד.",
};

const PARENT_SLUG = ICE_CREAMS_AND_NUTS_SLUG;

/**
 * The combined גלידות ופיצוחים category page.
 *
 * גלידות and פיצוחים remain separate categories in the database so the shop
 * owner can file each product correctly, but neither has a page of its own —
 * /ice-creams and /nuts permanently redirect here. On this page they appear as
 * filter tabs, exactly like the subcategories of ירקות and פירות.
 *
 * With no tab selected, fetchProductsByParentCategorySlug returns products
 * assigned to the combined parent AND to either child, each listed once.
 */
export default async function IceCreamsAndNutsPage({
  searchParams,
}: {
  searchParams: Promise<{ sub?: string }>;
}) {
  const { sub } = await searchParams;
  const heroConfig = getCategoryHero(PARENT_SLUG);

  const subcategories = await fetchChildCategoriesByParentSlug(PARENT_SLUG);

  const activeSubSlug =
    sub && subcategories.some((c) => c.slug === sub) ? sub : null;

  // Products appear here only once an administrator assigns them to the
  // combined category or to one of its two children. Nothing is auto-populated.
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
