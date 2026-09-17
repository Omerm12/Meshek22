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
