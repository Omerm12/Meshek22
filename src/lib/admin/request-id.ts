import { cache } from "react";
import { headers } from "next/headers";
import { ADMIN_REQUEST_ID_HEADER } from "@/lib/admin/request-headers";

/**
 * The correlation id Middleware minted for this request (see
 * src/lib/supabase/middleware.ts), memoised per request with React cache() —
 * the same pattern getAdminUser() uses — so every [admin:timing] log line for
 * one request/mutation (Middleware, Server Action, page render) can be
 * grep'd together without threading an id through every function signature.
 *
 * Falls back to a freshly generated id when the header is absent, OR when
 * headers() itself throws for having no request scope at all (a unit test
 * calling an action directly — confirmed by instrumentation.test.ts, which
 * calls completeMutation()/completeUpdateMutation() with no Next.js request
 * context) — so logs stay traceable, just not correlated with a
 * Middleware-stage log line.
 */
export const getRequestId = cache(async (): Promise<string> => {
  try {
    const h = await headers();
    return h.get(ADMIN_REQUEST_ID_HEADER) ?? crypto.randomUUID();
  } catch {
    return crypto.randomUUID();
  }
});
