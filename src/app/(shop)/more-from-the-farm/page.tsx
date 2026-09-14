import type { Metadata } from "next";
import { getCategoryHero } from "@/lib/config/category-heroes";
import { MORE_FROM_THE_FARM_SLUG } from "@/lib/config/nav-categories";
import { fetchParentCategoryPageData } from "@/lib/data/storefront";
import { ParentCategoryShell } from "@/components/shop/ParentCategoryShell";

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
 * childless ice-creams-and-nuts category) — fetchParentCategoryPageData()
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
