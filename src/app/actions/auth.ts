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

/**
 * Finalizes a new (or incomplete) user profile after OTP verification.
 *
 * Why a server action instead of a client-side write:
 * - We need to update auth.users.email via the admin API (service role), which
 *   cannot be called from the browser.
 * - Setting email_confirm: true ensures the email is immediately trusted without
 *   triggering a Supabase confirmation email — appropriate because the user already
 *   proved phone ownership via OTP.
 * - This sync is what makes the email OTP fallback work for future logins: Supabase's
 *   signInWithOtp({ email }) requires the email to exist in auth.users.
 *
 * Security model:
 * - Identity is verified server-side via createClient().auth.getUser().
 * - The profile update uses the admin client to bypass RLS (user's own row only,
 *   scoped by the verified user.id).
 * - displayPhone is stored in local Israeli format (0501234567); e164Phone is not
 *   stored in profiles (it's already in auth.users.phone).
 */
export async function finalizeNewUserProfile(params: {
  fullName: string;
  email: string;
  displayPhone: string;
}): Promise<{ error: string | null }> {
  const { fullName, email, displayPhone } = params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "לא נמצא משתמש מחובר." };
  }

  const admin = createAdminClient();

  // Sync email to auth.users with email_confirm: true (no confirmation email sent).
  // This enables the email OTP fallback for future login rate-limit scenarios.
  const { error: authUpdateError } = await admin.auth.admin.updateUserById(user.id, {
    email,
    email_confirm: true,
  });

  if (authUpdateError) {
    // Non-fatal if the email is already set to the same value — log and continue.
    console.warn("[finalizeNewUserProfile] auth.users email sync warning", {
      userId: user.id,
      message: authUpdateError.message,
    });
  }

  // Update display name in auth user metadata (surfaces in JWT claims / session).
  await supabase.auth.updateUser({ data: { full_name: fullName } });

  // Write the authoritative profile record.
  const { error: profileError } = await admin
    .from("profiles")
    .update({
      full_name:  fullName,
      email,
      phone:      displayPhone,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (profileError) {
    console.error("[finalizeNewUserProfile] profiles update failed", {
      userId: user.id,
      message: profileError.message,
    });
    return { error: "שגיאה בשמירת הפרטים. נסו שוב." };
  }

  return { error: null };
}
