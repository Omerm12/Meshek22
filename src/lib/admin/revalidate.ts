import { revalidatePath } from "next/cache";
import { ICE_CREAMS_AND_NUTS_HREF } from "@/lib/config/nav-categories";

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
  // The combined ice-cream + nut page. /ice-creams and /nuts are permanent
  // redirects with nothing to revalidate.
  ICE_CREAMS_AND_NUTS_HREF,
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
}
