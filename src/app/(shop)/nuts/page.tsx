import { permanentRedirect } from "next/navigation";
import { MERGED_CATEGORY_REDIRECTS } from "@/lib/config/nav-categories";

/**
 * Legacy route.
 *
 * פיצוחים is no longer a customer-facing page of its own — it is now the
 * פיצוחים child category under עוד מהמשק (more-from-the-farm). This route
 * issues a permanent (308) redirect straight to that subcategory tab so old
 * bookmarks and search results keep working.
 */
export default function LegacyNutsPage(): never {
  permanentRedirect(MERGED_CATEGORY_REDIRECTS["/nuts"]);
}
