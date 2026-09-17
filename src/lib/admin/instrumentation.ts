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
