import { permanentRedirect } from "next/navigation";
import { MERGED_CATEGORY_REDIRECTS } from "@/lib/config/nav-categories";

/**
 * Legacy route.
 *
 * פיצוחים is no longer a customer-facing page of its own — it was merged into
 * גלידות ופיצוחים. It still exists as a child category in the database so the
 * shop owner can file products as nuts, and it appears there as a filter tab.
 * This route issues a permanent (308) redirect so old bookmarks and search
 * results keep working.
 */
export default function LegacyNutsPage(): never {
  permanentRedirect(MERGED_CATEGORY_REDIRECTS["/nuts"]);
}
