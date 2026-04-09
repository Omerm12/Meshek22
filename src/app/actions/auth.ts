"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * Records the current timestamp as the user's last_login_at in the profiles table.
 *
 * Security model:
 * - The user's identity is verified via createClient().auth.getUser() (JWT validation
 *   against the Supabase Auth server — not a cookie-only claim).
 * - The write uses the admin (service role) client, which bypasses RLS. This ensures
 *   that last_login_at can only be set by trusted server code, not by a user directly
 *   calling the Supabase client from their browser.
 * - This is the ONLY way last_login_at gets updated — neither the user client nor any
 *   client-side code can touch this field.
 */
export async function recordLogin(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", user.id);
}
