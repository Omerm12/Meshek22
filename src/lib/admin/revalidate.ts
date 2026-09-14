import { revalidatePath, updateTag } from "next/cache";
import { MORE_FROM_THE_FARM_HREF } from "@/lib/config/nav-categories";

/**
 * Storefront paths that render catalog or promotion data.
 *
 * Kept in one place so every admin mutation refreshes the same set — in
 * particular /promotions, which is a virtual collection derived from sale
 * prices, legacy quantity deals and group promotions, and therefore changes
 * whenever any of those do.
 */
const STOREFRONT_PATHS = [
  "/",
  "/promotions",
  "/vegetables",
  "/fruits",
  // עוד מהמשק (formerly the combined ice-cream + nut page). /ice-creams,
  // /nuts and /ice-creams-and-nuts are permanent redirects with nothing to
  // revalidate.
  MORE_FROM_THE_FARM_HREF,
  "/search",
] as const;

/** Revalidate every public page whose contents depend on the catalog. */
export function revalidateStorefront(): void {
  for (const path of STOREFRONT_PATHS) {
    revalidatePath(path);
  }
  // The cart reads live promotions through this route handler.
  revalidatePath("/api/promotions/active");
  revalidatePath("/api/products/catalog");

  // The parent category pages (fruits/vegetables/more-from-the-farm) cache
  // their categories/products/promotions lookups with unstable_cache — see
  // fetchParentCategoryPageData() in src/lib/data/storefront.ts. revalidatePath
  // above covers the page shell, but these tags are what actually bust those
  // cached query results immediately instead of waiting out the 60s window.
  // updateTag() (not revalidateTag()) because this always runs inside a
  // Server Action, where it takes effect immediately instead of on next visit.
  updateTag("categories");
  updateTag("products");
  updateTag("promotions");
}
