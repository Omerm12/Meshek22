import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

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
  // Client-side UserProvider handles auth state for UI components (header, etc.)
  // via onAuthStateChange — no server round-trip needed here for public pages.
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

  // Refresh the session token if it's close to expiry
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect admin routes
  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (!user) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    // Admin role check happens in requireAdmin() inside the layout
  }

  // Protect account routes
  if (request.nextUrl.pathname.startsWith("/account")) {
    if (!user) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // /checkout auth is handled at the page level (shows CheckoutLoginGate instead
  // of redirecting), so no redirect needed here — but we still refresh the session.

  return supabaseResponse;
}
