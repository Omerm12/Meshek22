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
import { createClient } from "@/lib/supabase/server";
import { ADMIN_ROUTES } from "@/lib/admin/routes";

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
 * getUser() + profiles round-trip that every admin page previously paid twice.
 */
export const getAdminUser = cache(async (): Promise<AdminUser | null> => {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .single();

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
  if (!admin) redirect(ADMIN_ROUTES.login);
  return admin;
}
