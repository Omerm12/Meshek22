import { redirect } from "next/navigation";

/**
 * Minimal request-scoped timing for the admin panel's data loaders.
 *
 * One `console.log` per call: loader name, duration, and small non-sensitive
 * metadata (counts and booleans only). Never log names, addresses, phone
 * numbers, emails, payment data, tokens or service keys — the `meta` callback
 * receives the loader's result only to extract counts, not to be forwarded
 * wholesale.
 *
 * Cheap enough to run on every request in production: one pair of
 * `performance.now()` calls and one log line, so it can stay on permanently
 * and be read straight out of Vercel logs to confirm a fix actually landed.
 */
/**
 * Log one mutation's timing at an exit point.
 *
 * Unlike `withAdminTiming`, this is NOT a try/finally wrapper: several admin
 * mutations end with `redirect()`, which works by throwing — a wrapper based
 * on "did the function return or throw" would misreport every successful
 * create/update as a failure. Call this explicitly at each return site
 * instead (including right before a `redirect()` call).
 */
export function logMutationTiming(
  scope: string,
  startedAt: number,
  extra: Record<string, unknown> = {}
): void {
  console.log("[admin:timing]", {
    scope,
    totalMs: Math.round(performance.now() - startedAt),
    ...extra,
  });
}

/**
 * Distinguishes exactly what happened to an admin mutation, for the log line
 * only — never shown to the admin, never derived from form contents. Every
 * create/update action's control flow maps onto one of these:
 *
 *   auth_failed       requireAdmin() rejected the request (see requireAdmin()
 *                      in src/lib/admin/auth.ts, the single chokepoint every
 *                      action calls — logged there, not per-action).
 *   validation_failed  the submitted data failed schema validation; nothing
 *                      was written.
 *   write_failed       the database write itself returned an error.
 *   write_succeeded    the database write committed.
 *   post_write_failed  the write committed, but the best-effort cache
 *                      invalidation that follows threw. The row is still
 *                      saved — this is never reported to the admin as a
 *                      failed save.
 *   redirect_success   about to call redirect() back to the list — the
 *                      terminal step of a successful mutation.
 */
export type MutationStage =
  | "auth_failed"
  | "validation_failed"
  | "write_failed"
  | "write_succeeded"
  | "post_write_failed"
  | "redirect_success";

/**
 * Shared by completeMutation and completeUpdateMutation below: the database
 * write has already succeeded by the time this runs, so a failure in
 * `invalidate` (revalidatePath/revalidateStorefront — Next.js cache-marking
 * calls that do not perform I/O and essentially never throw, but are not
 * guaranteed not to) is logged as `post_write_failed`, distinct from
 * `write_failed`, and never turns into a false "the save failed" — the row is
 * saved either way, and cache staleness self-corrects within the existing
 * 60s window regardless.
 */
function finishMutation(
  scope: string,
  start: number,
  invalidate: () => void,
  writeSucceededExtra: Record<string, unknown>
): void {
  logMutationTiming(scope, start, {
    ...writeSucceededExtra,
    outcome: "success",
    stage: "write_succeeded" satisfies MutationStage,
  });

  try {
    invalidate();
  } catch (cacheErr) {
    logMutationTiming(scope, start, {
      stage: "post_write_failed" satisfies MutationStage,
      error: cacheErr instanceof Error ? cacheErr.message : String(cacheErr),
    });
  }
}

/**
 * The tail of every admin CREATE action: there is no existing row/page for
 * the admin to stay on, so this still redirects to the list once the write
 * (and best-effort cache invalidation) is done.
 *
 * Always throws via redirect() — callers should not expect this to return.
 * The thrown NEXT_REDIRECT is intentionally not caught here or anywhere else
 * server-side; see CategoryForm.tsx (and its siblings) for how the client
 * lets that same signal keep propagating instead of misreading it as failure.
 */
export function completeMutation(
  scope: string,
  start: number,
  redirectTo: string,
  invalidate: () => void,
  writeSucceededExtra: Record<string, unknown> = {}
): never {
  finishMutation(scope, start, invalidate, writeSucceededExtra);
  logMutationTiming(scope, start, { stage: "redirect_success" satisfies MutationStage });
  redirect(redirectTo);
}

/**
 * The tail of every admin UPDATE action: the admin is already looking at the
 * row being edited, so — unlike completeMutation — this does NOT redirect.
 * Redirecting to the list here would force a fresh `requireAdmin()` and the
 * list's own queries on top of the round trips the mutation itself already
 * paid for, just to land back on a page that doesn't even show the row being
 * edited in more detail than the form the admin is already looking at. The
 * client (see CategoryForm.tsx and its siblings) shows an inline "עודכן
 * בהצלחה" instead and stays on the form.
 */
export function completeUpdateMutation(
  scope: string,
  start: number,
  invalidate: () => void,
  writeSucceededExtra: Record<string, unknown> = {}
): { success: true } {
  finishMutation(scope, start, invalidate, writeSucceededExtra);
  return { success: true };
}

export async function withAdminTiming<T>(
  scope: string,
  run: () => Promise<T>,
  meta?: (result: T) => Record<string, unknown>
): Promise<T> {
  const start = performance.now();
  try {
    const result = await run();
    console.log("[admin:timing]", {
      scope,
      durationMs: Math.round(performance.now() - start),
      ...(meta ? meta(result) : {}),
    });
    return result;
  } catch (thrown) {
    console.log("[admin:timing]", {
      scope,
      durationMs: Math.round(performance.now() - start),
      error: true,
    });
    throw thrown;
  }
}
