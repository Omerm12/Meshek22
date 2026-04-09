import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Routes that require an authenticated user.
 * getUser() (a network round-trip to Supabase Auth) is ONLY called for these.
 * All public pages (/,  /category/*, /product/*, etc.) skip the auth check
 * entirely — saving ~300-500 ms per request.
 */
function isProtectedRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/account") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/checkout")
  );
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Fast path: public routes don't need a session check at all.
  if (!isProtectedRoute(request.nextUrl.pathname)) {
    return supabaseResponse;
  }

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

  // Run getUser (JWT validation against Supabase Auth) and the profiles
  // last_login_at query in parallel — same session, both needed on protected routes.
  // RLS (profiles_own_select: auth.uid() = id) ensures the profiles query returns
  // only the current user's row without needing an explicit .eq("id", user.id).
  const [
    { data: { user } },
    { data: profile },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("profiles")
      .select("last_login_at")
      .maybeSingle(),
  ]);

  // ── 14-day expiry enforcement (server-authoritative) ────────────────────────
  //
  // last_login_at is written exclusively by the recordLogin() Server Action using
  // the admin client — users cannot update it directly. Only checked when the user
  // has an authenticated session AND has a recorded last_login_at.
  //
  // On expiry:
  //   1. supabase.auth.signOut() revokes the refresh token server-side via the
  //      Supabase Auth REST API — the user cannot obtain new access tokens.
  //   2. sb-* cookies are deleted from the redirect response so the browser
  //      immediately loses its session.
  //
  // Honest limitation: the current access token stays technically valid for up to
  // 1 hour (its remaining lifetime). However, without a valid refresh token, it
  // cannot be renewed. On the next access-token expiry the user is fully logged out.
  if (user && profile?.last_login_at) {
    const isExpired =
      Date.now() - new Date(profile.last_login_at).getTime() > FOURTEEN_DAYS_MS;

    if (isExpired) {
      // Revoke the refresh token server-side
      await supabase.auth.signOut();

      // Redirect to home and clear all Supabase auth cookies
      const redirectResponse = NextResponse.redirect(
        new URL("/", request.url)
      );
      request.cookies
        .getAll()
        .filter(({ name }) => name.startsWith("sb-"))
        .forEach(({ name }) => redirectResponse.cookies.delete(name));
      return redirectResponse;
    }
  }

  // ── Route protection ────────────────────────────────────────────────────────

  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (!user) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    // Admin role check happens in requireAdmin() inside the layout
  }

  if (request.nextUrl.pathname.startsWith("/account")) {
    if (!user) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // /checkout auth is handled at the page level (shows CheckoutLoginGate instead
  // of redirecting), so no redirect needed here — but we still refresh the session.

  return supabaseResponse;
}
