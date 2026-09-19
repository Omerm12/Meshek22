import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { getCategoryHero } from "@/lib/config/category-heroes";
import { DEDICATED_PARENT_ROUTES } from "@/lib/config/nav-categories";
import { fetchParentCategoryPageData } from "@/lib/data/storefront";
import { ParentCategoryShell } from "@/components/shop/ParentCategoryShell";

/**
 * The generic parent-category landing page.
 *
 * /vegetables, /fruits and /more-from-the-farm each keep their own dedicated
 * route (predating this one, SEO-indexed, listed in DEDICATED_PARENT_ROUTES)
 * — this route exists so that any OTHER active top-level category, created
 * entirely through the admin with no code change, still gets a working page
 * the moment an admin flags it show_in_navbar (or links it directly). It is
 * the same ParentCategoryShell + fetchParentCategoryPageData() every
 * dedicated page already uses; only the slug is resolved at request time
 * instead of hardcoded per file.
 */

interface PageParams {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sub?: string }>;
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { slug } = await params;
  const heroConfig = getCategoryHero(slug);
  return {
    title: `${heroConfig.title} – משק 22`,
    description: heroConfig.subtitle || undefined,
  };
}

export default async function GenericParentCategoryPage({ params, searchParams }: PageParams) {
  const { slug } = await params;

  // A dedicated page already owns this slug's URL — redirect rather than
  // render a second, competing page for the same category (duplicate content,
  // and a stale link here would silently diverge from the real page).
  const dedicatedHref = DEDICATED_PARENT_ROUTES[slug];
  if (dedicatedHref) {
    permanentRedirect(dedicatedHref);
  }

  const { sub } = await searchParams;
  const heroConfig = getCategoryHero(slug);

  const { subcategories, activeSubSlug, products } =
    await fetchParentCategoryPageData(slug, sub ?? null);

  return (
    <ParentCategoryShell
      heroConfig={heroConfig}
      parentSlug={slug}
      basePath={`/category/${slug}`}
      subcategories={subcategories}
      products={products}
      activeSubSlug={activeSubSlug}
    />
  );
}
