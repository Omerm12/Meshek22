import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component – cookies set in middleware
          }
        },
      },
    }
  );
}

/**
 * Service role client – use only in trusted server contexts (Server Components,
 * Route Handlers, Server Actions). Bypasses RLS via the service role key.
 *
 * Intentionally does NOT use @supabase/ssr or cookies(). A service role client
 * authenticates via its key alone — there is no user session to manage, no token
 * to refresh, and no cookies to read. Using createServerClient here was wrong:
 * it caused @supabase/ssr to attempt session refresh fetches (with AbortSignal
 * timeouts) on every request, producing TimeoutError in production.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
