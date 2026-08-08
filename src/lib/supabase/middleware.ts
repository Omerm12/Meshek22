import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { ADMIN_BASE_PATH, ADMIN_ROUTES } from "@/lib/admin/routes";

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

  // One call: validates the JWT and refreshes the cookie if needed. The profile
  // role lookup is NOT repeated here — requireAdmin() does it once per request
  // and caches it, so duplicating it in middleware would only add latency.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL(ADMIN_ROUTES.login, request.url));
  }

  return supabaseResponse;
}
