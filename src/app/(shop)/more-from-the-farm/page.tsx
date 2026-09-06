import type { Metadata } from "next";
import { getCategoryHero } from "@/lib/config/category-heroes";
import { MORE_FROM_THE_FARM_SLUG } from "@/lib/config/nav-categories";
import {
  fetchChildCategoriesByParentSlug,
  fetchProductsByCategory,
  fetchProductsByParentCategorySlug,
} from "@/lib/data/storefront";
import { ParentCategoryShell } from "@/components/shop/ParentCategoryShell";

// Dynamic because rendering depends on the ?sub= search param — same reason
// as /fruits and /vegetables.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "עוד מהמשק – משק 22",
  description:
    "מגוון מוצרים נוספים ממשק 22 — תבלינים, ביצים, פיצוחים, שמן זית, ירקות קרנצ'ים, סכינים ומקלפים וגלידות.",
};

const PARENT_SLUG = MORE_FROM_THE_FARM_SLUG;

/**
 * עוד מהמשק — same architecture as the fruits/vegetables pages: a parent
 * category page with real child-category tabs.
 *
 * Unlike fruits/vegetables, this parent may also carry products assigned
 * directly to it (left over from before it was renamed from the flat,
 * childless ice-creams-and-nuts category) — fetchProductsByParentCategorySlug
 * already includes those alongside each child's products, so they keep
 * appearing on the "הכל" view with no special-casing here.
 */
export default async function MoreFromTheFarmPage({
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
