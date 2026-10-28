import { redirect } from "next/navigation";
import { after } from "next/server";
import { getRequestId } from "@/lib/admin/request-id";

/**
 * Runs `fn` via Next.js's after() — i.e. once the response has already been
 * generated and sent — instead of inline. Used to defer
 * revalidatePath/revalidateTag/updateTag calls: those mark a single,
 * request-WIDE flag (not scoped to which path was revalidated — see
 * node_modules/next/dist/server/app-render/action-handler.js's
 * `executeActionAndPrepareForRender` and
 * node_modules/next/dist/server/web/spec-extension/revalidate.js, which has
 * its own `// TODO: only revalidate if the path matches` comment) that makes
 * Next.js re-render whatever page the current Server Action was invoked
 * from, as part of THIS action's own response — even when none of the
 * revalidated paths have anything to do with that page. Calling
 * revalidation from inside after() means nothing sets that flag until after
 * the response is already on its way, so the admin never pays for that
 * extra, usually-wasted re-render.
 *
 * Falls back to running `fn` immediately if after() itself throws — it
 * requires a real Next.js request scope, absent in unit tests that call
 * these mutation helpers directly (see instrumentation.test.ts and
 * orders/actions.test.ts). Every real request has a request scope, so
 * production always takes the after() path.
 */
export function runAfterResponse(fn: () => void): void {
  try {
    after(fn);
  } catch {
    fn();
  }
}

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
 * write has already succeeded by the time this runs.
 *
 * `invalidate` (revalidatePath/revalidateStorefront/revalidateTag/updateTag)
 * runs inside after(), not inline. This isn't just about not blocking the
 * response — it changes what Next.js does with THIS response.
 * revalidatePath/revalidateTag/updateTag mark a single, request-WIDE flag
 * (`workStore.pathWasRevalidated` — see
 * node_modules/next/dist/server/app-render/action-handler.js's
 * `executeActionAndPrepareForRender` and
 * node_modules/next/dist/server/web/spec-extension/revalidate.js, which
 * itself has a `// TODO: only revalidate if the path matches` comment) —
 * NOT scoped to which path was revalidated. If that flag is set by the time
 * the action function returns, Next.js re-renders whatever page the admin
 * is currently viewing as part of THIS action's own response, even when
 * every revalidated path (e.g. the storefront's /, /vegetables, /product/x
 * from revalidateStorefront()) has nothing to do with the admin edit page
 * being looked at. That extra, wasted re-render — re-running the edit
 * page's own Supabase queries — was invisible to completeUpdateMutation's
 * own {success:true} timing in a prior pass at this problem; it shows up
 * as Next.js Function time AFTER the action body returns, not inside it.
 * Deferring invalidation to after() means nothing calls
 * revalidatePath/revalidateTag/updateTag until after the response has
 * already been generated and sent — `pathWasRevalidated` stays undefined
 * for the whole synchronous action body, so Next.js skips that re-render.
 * Invalidation itself still runs, just a moment later — it was already
 * best-effort/non-blocking (see the try/catch below, unchanged), so a few
 * extra milliseconds before the storefront cache clears is not a
 * regression.
 */
async function finishMutation(
  scope: string,
  start: number,
  invalidate: () => void,
  writeSucceededExtra: Record<string, unknown>
): Promise<void> {
  const reqId = await getRequestId();

  logMutationTiming(scope, start, {
    ...writeSucceededExtra,
    reqId,
    outcome: "success",
    stage: "write_succeeded" satisfies MutationStage,
  });

  runAfterResponse(() => {
    try {
      invalidate();
    } catch (cacheErr) {
      logMutationTiming(scope, start, {
        reqId,
        stage: "post_write_failed" satisfies MutationStage,
        error: cacheErr instanceof Error ? cacheErr.message : String(cacheErr),
      });
    }
  });
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
export async function completeMutation(
  scope: string,
  start: number,
  redirectTo: string,
  invalidate: () => void,
  writeSucceededExtra: Record<string, unknown> = {}
): Promise<never> {
  await finishMutation(scope, start, invalidate, writeSucceededExtra);
  logMutationTiming(scope, start, {
    stage: "redirect_success" satisfies MutationStage,
    reqId: await getRequestId(),
  });
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
export async function completeUpdateMutation(
  scope: string,
  start: number,
  invalidate: () => void,
  writeSucceededExtra: Record<string, unknown> = {}
): Promise<{ success: true }> {
  await finishMutation(scope, start, invalidate, writeSucceededExtra);
  return { success: true };
}

/**
 * The tail of every admin DELETE action (and the promotion active/inactive
 * toggle): like completeUpdateMutation, the admin is already looking at the
 * list they're deleting a row from — there is no reason to redirect. Every
 * delete/toggle action used to call revalidatePath/revalidateStorefront
 * inline instead of through finishMutation, which reproduced the exact
 * "forced re-render of the page you're already on" problem completeMutation/
 * completeUpdateMutation were split out to fix for creates/updates — it was
 * simply never applied to delete, since it was added afterwards. Same fix,
 * same helper, just named for its call sites.
 */
export async function completeDeleteMutation(
  scope: string,
  start: number,
  invalidate: () => void,
  writeSucceededExtra: Record<string, unknown> = {}
): Promise<{ success: true }> {
  await finishMutation(scope, start, invalidate, writeSucceededExtra);
  return { success: true };
}

export async function withAdminTiming<T>(
  scope: string,
  run: () => Promise<T>,
  meta?: (result: T) => Record<string, unknown>
): Promise<T> {
  const start = performance.now();
  const reqId = await getRequestId();
  try {
    const result = await run();
    console.log("[admin:timing]", {
      scope,
      reqId,
      durationMs: Math.round(performance.now() - start),
      ...(meta ? meta(result) : {}),
    });
    return result;
  } catch (thrown) {
    console.log("[admin:timing]", {
      scope,
      reqId,
      durationMs: Math.round(performance.now() - start),
      error: true,
    });
    throw thrown;
  }
}
