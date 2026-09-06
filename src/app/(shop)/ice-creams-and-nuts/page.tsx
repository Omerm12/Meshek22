import { permanentRedirect } from "next/navigation";
import { MERGED_CATEGORY_REDIRECTS } from "@/lib/config/nav-categories";

/**
 * Legacy route.
 *
 * גלידות ופיצוחים is no longer a customer-facing page of its own — its
 * category row was renamed and broadened into עוד מהמשק (more-from-the-farm),
 * which is where every product previously filed here still lives (same row,
 * same id, nothing moved). This route issues a permanent (308) redirect so
 * old bookmarks and search results keep working.
 */
export default function LegacyIceCreamsAndNutsPage(): never {
  permanentRedirect(MERGED_CATEGORY_REDIRECTS["/ice-creams-and-nuts"]);
}
