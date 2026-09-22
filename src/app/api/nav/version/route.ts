import { NextResponse } from "next/server";
import { fetchNavbarVersion } from "@/lib/data/storefront";

/**
 * Polled by Header.tsx (throttled to at most once per 60s per tab) so an
 * already-open browser tab can detect a navbar change made by an admin in
 * another session, without server-side revalidation (revalidatePath/
 * updateTag in src/lib/admin/revalidate.ts) being able to reach into that
 * tab's client-side Router Cache on its own.
 *
 * Deliberately NOT given `export const revalidate` / Full Route Cache: the
 * only real work here, fetchNavbarVersion(), already shares its result with
 * fetchNavbarCategoryTree() via the same tagged unstable_cache entry, so a
 * second cache layer on this route would just be one more thing to keep in
 * sync with revalidateStorefront() for no benefit — every request already
 * costs at most the one shared, tag-invalidated Supabase query.
 */
export async function GET() {
  const version = await fetchNavbarVersion();
  return NextResponse.json({ version });
}
