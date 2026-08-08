import { permanentRedirect } from "next/navigation";

/**
 * Legacy route.
 *
 * "כל המוצרים" was removed from the storefront in favour of dedicated category
 * pages. This route is kept solely so old bookmarks, printed material and
 * search-engine results do not 404 — it issues a permanent (308) redirect to the
 * homepage, from which every category is one click away.
 */
export default function LegacyProductsPage(): never {
  permanentRedirect("/");
}
