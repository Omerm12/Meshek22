/**
 * Cookie-free Supabase client for public (unauthenticated) catalog reads.
 *
 * The SSR client from @/lib/supabase/server calls cookies() on every invocation,
 * which opts the entire Next.js route into dynamic rendering and prevents ISR
 * caching. Public catalog queries (categories, products, zones) don't need any
 * user session — they rely on Supabase RLS with the anon key and public policies.
 *
 * Using this client instead of the SSR client for those queries means:
 * - No cookies() call → Next.js can ISR-cache the route
 * - A single shared client instance across requests in the same process (no
 *   per-request allocation overhead)
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

let _client: ReturnType<typeof createSupabaseClient<Database>> | null = null;

export function createPublicClient(): ReturnType<
  typeof createSupabaseClient<Database>
> {
  if (!_client) {
    _client = createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _client;
}
