"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import {
  MissingRateLimitSaltError,
  isAdminLoginRateLimited,
  recordAdminLoginAttempt,
} from "@/lib/admin/rate-limit";

/**
 * The single Hebrew error returned for EVERY failure mode — unknown username,
 * wrong password, or a valid account that is not an administrator. Callers can
 * therefore learn nothing about which usernames exist.
 */
const GENERIC_ERROR = "שם המשתמש או הסיסמה שגויים";
const RATE_LIMIT_ERROR = "יותר מדי ניסיונות התחברות. נסו שוב בעוד מספר דקות.";
/** Shown when the server is misconfigured — distinct from a wrong password. */
const CONFIG_ERROR =
  "תצורת השרת אינה מלאה ולכן ההתחברות חסומה. יש לפנות למנהל המערכת.";

export interface AdminLoginState {
  error: string | null;
}

/** Best-effort client IP from the proxy headers Vercel/Next set. */
async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}

/**
 * Administrator sign-in.
 *
 * The form asks for שם משתמש + סיסמה. Supabase Auth underneath is an
 * email/password provider, so the username is mapped to the real auth email
 * through server-only environment variables — the mapping never reaches the
 * browser and is not part of the bundle.
 *
 * Flow:
 *   1. Rate-limit check by IP and by submitted username.
 *   2. Map username → auth email. An unknown username still performs the same
 *      work and returns the same message.
 *   3. Authenticate with Supabase (which stores the hashed password; this app
 *      never sees, stores or logs a password).
 *   4. Verify the resulting user exists and profiles.role === 'admin'.
 *   5. Sign straight back out if the role is not admin, so a non-admin account
 *      is never left holding a session created by this form.
 *   6. Redirect to the dashboard server-side.
 */
export async function adminLogin(
  _prevState: AdminLoginState,
  formData: FormData
): Promise<AdminLoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: GENERIC_ERROR };
  }

  const ip = await getClientIp();
  const identities = [
    { kind: "ip" as const, value: ip },
    { kind: "username" as const, value: username },
  ];

  // A missing rate-limit salt fails closed: without it the stored identity
  // digests would be unsalted and trivially reversible, so sign-in is refused
  // rather than run unprotected. The admin sees a generic message; the real
  // cause is logged server-side only.
  try {
    if (await isAdminLoginRateLimited(identities)) {
      return { error: RATE_LIMIT_ERROR };
    }
  } catch (thrown) {
    if (thrown instanceof MissingRateLimitSaltError) {
      console.error("[adminLogin] refusing to sign in: ADMIN_RATE_LIMIT_SALT is not configured");
      return { error: CONFIG_ERROR };
    }
    throw thrown;
  }

  const expectedUsername = process.env.ADMIN_LOGIN_USERNAME ?? "";
  const authEmail = process.env.ADMIN_AUTH_EMAIL ?? "";

  if (!expectedUsername || !authEmail) {
    console.error("[adminLogin] ADMIN_LOGIN_USERNAME / ADMIN_AUTH_EMAIL are not configured");
    return { error: GENERIC_ERROR };
  }

  // Case-insensitive username comparison; the password itself is verified by
  // Supabase Auth, never here.
  const usernameMatches =
    username.toLowerCase() === expectedUsername.trim().toLowerCase();

  const supabase = await createClient();

  // A wrong username still runs a real password check against a non-existent
  // address, so success and failure take a comparable amount of time.
  const { data, error } = await supabase.auth.signInWithPassword({
    email: usernameMatches ? authEmail : `${username}@invalid.local`,
    password,
  });

  if (error || !data.user) {
    await recordAdminLoginAttempt(identities, false);
    return { error: GENERIC_ERROR };
  }

  // Authenticated — now confirm this account is actually an administrator.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    // Do not leave a usable session behind for a non-admin account.
    await supabase.auth.signOut();
    await recordAdminLoginAttempt(identities, false);
    return { error: GENERIC_ERROR };
  }

  await recordAdminLoginAttempt(identities, true);

  // Server-side redirect: the session cookie is already set, and no client-side
  // navigation is relied upon for access control.
  redirect(ADMIN_ROUTES.dashboard);
}

/** Sign out and return to the login screen. */
export async function adminLogout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(ADMIN_ROUTES.login);
}
