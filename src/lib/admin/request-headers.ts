/**
 * Header names used to pass verified-request state from Middleware
 * (src/lib/supabase/middleware.ts) to the downstream Server Component/Action
 * execution for the SAME request.
 *
 * No Node-specific imports here — this file is imported from Middleware,
 * which runs in the Edge runtime.
 *
 * Security note: both headers are meaningful ONLY because Middleware
 * unconditionally strips any incoming value before setting its own. A client
 * can never inject either value itself — by the time a request reaches the
 * protected layout or a Server Action, these headers reflect only what
 * Middleware itself verified for this exact request, or are absent.
 */

/**
 * Set to the verified user's id, but ONLY after Middleware's own
 * `supabase.auth.getUser()` call has cryptographically validated the session
 * against the Auth server. getAdminUser() (src/lib/admin/auth.ts) trusts this
 * to skip a second, redundant getUser() network round trip for the same
 * token — it never skips the separate profiles/role lookup.
 */
export const ADMIN_VERIFIED_USER_ID_HEADER = "x-admin-verified-user-id";

/**
 * A correlation id minted once per request by Middleware, purely for log
 * correlation — safe to fall back to a freshly generated one if absent (e.g.
 * a request that didn't pass through Middleware), since it carries no
 * authorization meaning.
 */
export const ADMIN_REQUEST_ID_HEADER = "x-admin-request-id";
