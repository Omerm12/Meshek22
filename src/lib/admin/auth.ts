/**
 * Server-side admin authorization guard.
 *
 * Usage — call at the top of every admin layout/page/action:
 *
 *   const admin = await requireAdmin();
 *   // admin.id, admin.full_name, admin.email are available
 *
 * Security model:
 * 1. Verify a valid Supabase session exists (getUser() — verifies JWT with
 *    the auth server, not just a local decode).
 * 2. Fetch the user's own profile row to read their role. This uses the
 *    regular SSR client (anon key + user session), which is allowed by the
 *    existing `profiles_own_select` RLS policy.
 * 3. If role !== 'admin', redirect to "/" silently. No hint to the caller
 *    about WHY they were redirected (prevents role enumeration).
 *
 * This must only be called from Server Components or Server Actions —
 * never from client-side code.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
}

export async function requireAdmin(): Promise<AdminUser> {
  const supabase = await createClient();

  // Step 1: verify a valid session token with Supabase Auth.
  // getUser() makes a network request to validate the JWT — it cannot be
  // spoofed by manipulating a cookie value.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/");
  }

  // Step 2: read the role from the profiles table.
  // The user is reading their own row — allowed by profiles_own_select policy.
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .single();

  // Step 3: hard gate — redirect to home for any failure or non-admin role.
  // We redirect to "/" rather than showing a 403 page to avoid leaking
  // that an admin area exists at all.
  if (error || !profile || profile.role !== "admin") {
    redirect("/");
  }

  return {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    role: profile.role,
  };
}
