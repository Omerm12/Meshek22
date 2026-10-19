/**
 * Removes the nearest table row / list item ancestor from the DOM after a
 * successful delete.
 *
 * Every admin list page is a Server Component; the delete buttons inside it
 * used to call router.refresh() on success, which re-runs the WHOLE page's
 * Server Component queries just to make one row disappear — exactly the
 * "forced re-render of the page you're already on" cost the update path was
 * fixed for (see completeDeleteMutation in src/lib/admin/instrumentation.ts),
 * just triggered from the client instead of the server. The row is already
 * gone from the database by the time this runs; hiding it locally is enough,
 * and the server-side deferred revalidation still refreshes the cache for
 * the next real navigation.
 */
export function hideDeletedRow(el: HTMLElement | null): void {
  const row = el?.closest("tr, li");
  if (row instanceof HTMLElement) {
    row.style.display = "none";
  }
}
