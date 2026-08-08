import type { Metadata } from "next";
import { getCategoryHero } from "@/lib/config/category-heroes";
import { ICE_CREAMS_AND_NUTS_SLUG } from "@/lib/config/nav-categories";
import { fetchProductsByCategory } from "@/lib/data/storefront";
import { ParentCategoryShell } from "@/components/shop/ParentCategoryShell";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "גלידות ופיצוחים – משק 22",
  description:
    "משהו מתוק, משהו מלוח — גלידות, ארטיקים, אגוזים ופיצוחים, הכל בעמוד אחד ובמשלוח אחד.",
};

/**
 * גלידות ופיצוחים — one flat category, one page.
 *
 * There is exactly one database category (`ice-creams-and-nuts`) and no children,
 * so this page has no subcategory tabs and no `?sub=` filtering. Every product
 * the administrator files under the category appears here once, in the same grid,
 * with the same cards, cart behaviour and promotion pricing as every other
 * category page.
 *
 * fetchProductsByCategory reads by category slug directly, so a product can only
 * be returned once — there is no parent/child union to deduplicate.
 */
export default async function IceCreamsAndNutsPage() {
  const heroConfig = getCategoryHero(ICE_CREAMS_AND_NUTS_SLUG);
  const products = await fetchProductsByCategory(ICE_CREAMS_AND_NUTS_SLUG);

  return (
    <ParentCategoryShell
      heroConfig={heroConfig}
      parentSlug={ICE_CREAMS_AND_NUTS_SLUG}
      subcategories={[]}
      products={products}
      activeSubSlug={null}
    />
  );
}
