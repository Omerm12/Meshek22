import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { ADMIN_BASE_PATH, ADMIN_ROUTES } from "@/lib/admin/routes";
import { ADMIN_VERIFIED_USER_ID_HEADER, ADMIN_REQUEST_ID_HEADER } from "@/lib/admin/request-headers";

/**
 * Session handling for the administrator portal.
 *
 * The storefront is entirely anonymous — guests browse, add to cart and check
 * out with no account — so no public route touches Supabase Auth here. The only
 * paths that need a session refresh are the administrator pages, which keeps the
 * Auth round-trip off the homepage, the category pages and checkout entirely.
 *
 * The work done here is intentionally minimal: refresh the session cookie and
 * bounce anonymous visitors to the login screen. The authoritative role check
 * lives in requireAdmin() inside the protected layout and inside every mutation
 * Server Action — middleware is a convenience, never the security boundary.
 */
function needsSession(pathname: string): boolean {
  return pathname.startsWith(ADMIN_BASE_PATH);
}

/**
 * The auth.getUser() call below can internally trigger an inline session
 * refresh (a POST to /token?grant_type=refresh_token) when the stored access
 * token
 * is expired, and @supabase/auth-js retries that refresh with exponential
 * backoff (200ms, 400ms, 800ms, ...) for up to 30s on a retryable error
 * (network failure or a 502/503/504) — see
 * node_modules/@supabase/auth-js/dist/main/GoTrueClient.js's
 * `_refreshAccessToken`. Production traces on this project showed Middleware
 * spiking to 6+ seconds, consistent with a few such retries. Uncapped, a
 * single flaky round trip to Supabase Auth can stall every admin page load
 * for up to 30s. This bound converts that into a fixed, predictable ceiling
 * — on timeout we fail exactly like a real auth failure (redirect to login),
 * never fail open.
 */
const AUTH_CHECK_TIMEOUT_MS = 6000;

class AuthCheckTimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new AuthCheckTimeoutError(`auth check exceeded ${ms}ms`)),
      ms
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Fast path: every public route skips Supabase entirely.
  if (!needsSession(pathname)) {
    return NextResponse.next({ request });
  }

  // The login page must stay reachable without a session.
  if (pathname === ADMIN_ROUTES.login) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const reqId = crypto.randomUUID();

  // One call: validates the JWT and refreshes the cookie if needed. The profile
  // role lookup is NOT repeated here — requireAdmin() does it once per request
  // and caches it, so duplicating it in middleware would only add latency.
  //
  // Bounded by AUTH_CHECK_TIMEOUT_MS (see above) so a slow/flaky round trip to
  // Supabase Auth can never stall the whole request for longer than that fixed
  // ceiling — a timeout is treated exactly like "not authenticated" below,
  // same as any other getUser() failure; it never fails open.
  const authStart = Date.now();
  let user: { id: string } | null = null;
  let error: { code?: string } | null = null;
  let timedOut = false;

  try {
    const result = await withTimeout(supabase.auth.getUser(), AUTH_CHECK_TIMEOUT_MS);
    user = result.data.user;
    error = result.error;
  } catch (thrown) {
    timedOut = thrown instanceof AuthCheckTimeoutError;
    if (!timedOut) {
      console.error("[admin:timing]", {
        scope: "middleware-auth",
        reqId,
        stage: "unexpected_error",
        error: thrown instanceof Error ? thrown.message : String(thrown),
      });
    }
  }
  const authMs = Date.now() - authStart;

  console.log("[admin:timing]", {
    scope: "middleware-auth",
    reqId,
    pathname,
    authMs,
    outcome: timedOut ? "timeout" : error ? "error" : user ? "success" : "no_user",
    errorCode: error?.code,
  });

  // A refresh token Supabase has already rejected (rotated away by a
  // concurrent request on the same navigation, or left over from a previous
  // session) will never succeed on retry — leaving it in place would just
  // reproduce this exact AuthApiError on every subsequent admin request.
  // signOut() clears only the cookies THIS client's cookie adapter manages
  // (the Supabase auth cookies), never cart/accessibility/other app cookies,
  // and never the tokens themselves are read or logged. No mutation is
  // attempted and no retry happens — the admin is sent straight to a clean
  // login with a plain-language reason.
  if (error?.code === "refresh_token_not_found") {
    await supabase.auth.signOut();

    const loginUrl = new URL(ADMIN_ROUTES.login, request.url);
    loginUrl.searchParams.set("reason", "session_expired");
    const redirectResponse = NextResponse.redirect(loginUrl);
    // Carry over the cleared-cookie headers signOut() just wrote onto
    // supabaseResponse via the cookie adapter's setAll — a bare
    // NextResponse.redirect() here would leave the stale cookie in the
    // browser and reproduce the same error on the very next admin request.
    for (const cookie of supabaseResponse.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }
    return redirectResponse;
  }

  if (!user) {
    return NextResponse.redirect(new URL(ADMIN_ROUTES.login, request.url));
  }

  // Hand the already-verified identity and a correlation id to the
  // downstream Server Component/Action render, so getAdminUser() (see
  // src/lib/admin/auth.ts) doesn't pay for a second, redundant getUser()
  // network round trip re-verifying the SAME token for the SAME request.
  // Strip any incoming values first — this header must only ever reflect
  // OUR verification above; a client can never inject its own value, since
  // by the time a request reaches the layout or a Server Action, whatever
  // is set here can only have been set by this code, moments earlier, for
  // this exact request.
  request.headers.delete(ADMIN_VERIFIED_USER_ID_HEADER);
  request.headers.set(ADMIN_VERIFIED_USER_ID_HEADER, user.id);
  request.headers.delete(ADMIN_REQUEST_ID_HEADER);
  request.headers.set(ADMIN_REQUEST_ID_HEADER, reqId);

  const finalResponse = NextResponse.next({ request });
  // Carry over any Set-Cookie headers queued on supabaseResponse (from a
  // token refresh inside getUser() above) onto the response that actually
  // carries our new request headers.
  for (const cookie of supabaseResponse.cookies.getAll()) {
    finalResponse.cookies.set(cookie);
  }
  return finalResponse;
}
