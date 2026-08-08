import { revalidatePath } from "next/cache";

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
  "/ice-creams",
  "/nuts",
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
