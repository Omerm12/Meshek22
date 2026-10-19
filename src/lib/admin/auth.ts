/**
 * Server-side administrator authorization.
 *
 * Security model
 * --------------
 * 1. getUser() validates the JWT against the Supabase Auth server, so a forged
 *    or edited cookie cannot pass. A local decode is never trusted.
 * 2. The caller's own profile row is read to check role === 'admin'. This uses
 *    the regular SSR client (anon key + user session), permitted by the existing
 *    `profiles_own_select` RLS policy.
 * 3. Anything other than an admin is redirected to the admin login page with no
 *    explanation, so the response cannot be used to enumerate accounts or roles.
 *
 * The protected layout calls requireAdmin() once per request; every mutation
 * Server Action calls it again independently, so authorisation never depends on
 * a parent component having run. React `cache()` makes those repeated calls free
 * — the Auth round-trip and the profile query happen at most once per request.
 *
 * Server Components and Server Actions only. Never import from client code.
 */

import { cache } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { ADMIN_VERIFIED_USER_ID_HEADER } from "@/lib/admin/request-headers";
import { getRequestId } from "@/lib/admin/request-id";

export interface AdminUser {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
}

/**
 * Resolve the current admin, or null.
 *
 * Wrapped in React cache() so the layout, the page and any Server Action in the
 * same request share one result. This removed the duplicate
 * getUser() + profiles round-trip that every admin page previously paid twice
 * WITHIN one execution context.
 *
 * That said, cache() does NOT span execution contexts: Middleware
 * (src/lib/supabase/middleware.ts) runs as a genuinely separate invocation
 * from the Server Component/Action render that follows it (confirmed by
 * production traces showing independent Middleware vs Function durations),
 * so its own getUser() call is never deduplicated by this cache() on its
 * own. Middleware instead forwards proof of its own verification via
 * ADMIN_VERIFIED_USER_ID_HEADER — see the comment on that constant for why
 * that header can be trusted. When present, this skips the second getUser()
 * network round trip entirely and goes straight to the (always-required)
 * profiles/role lookup; when absent (a request that didn't pass through
 * Middleware), it falls back to the original, fully independent check.
 */
export const getAdminUser = cache(async (): Promise<AdminUser | null> => {
  const start = performance.now();
  const supabase = await createClient();
  const [hdrs, reqId] = await Promise.all([headers(), getRequestId()]);
  const verifiedUserId = hdrs.get(ADMIN_VERIFIED_USER_ID_HEADER);

  let userId: string;

  if (verifiedUserId) {
    userId = verifiedUserId;
  } else {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log("[admin:timing]", {
        scope: "admin-auth",
        reqId,
        stage: "getUser_failed",
        verifiedByMiddleware: false,
        durationMs: Math.round(performance.now() - start),
      });
      return null;
    }
    userId = user.id;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", userId)
    .single();

  console.log("[admin:timing]", {
    scope: "admin-auth",
    reqId,
    stage: "resolved",
    verifiedByMiddleware: !!verifiedUserId,
    durationMs: Math.round(performance.now() - start),
  });

  if (error || !profile || profile.role !== "admin") return null;

  return {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    role: profile.role,
  };
});

/**
 * Hard gate: returns the admin or never returns.
 * Call at the top of the protected layout and inside every mutation action.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdminUser();
  if (!admin) {
    // The single chokepoint every action and the protected layout call, so
    // one log line here covers auth_failed for all of them — see
    // src/lib/admin/instrumentation.ts for the full mutation-stage vocabulary.
    console.log("[admin:timing]", { scope: "auth", stage: "auth_failed", reqId: await getRequestId() });
    redirect(ADMIN_ROUTES.login);
  }
  return admin;
}
