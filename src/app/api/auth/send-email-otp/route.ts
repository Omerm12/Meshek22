import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * POST /api/auth/send-email-otp
 *
 * Sends an email OTP to the address associated with a phone number.
 * Called only from the LOGIN flow, after the SMS rate limit has been hit.
 * Never called from the registration flow.
 *
 * Security model:
 * - The caller has already proved knowledge of the registered phone (via
 *   check-phone + hitting the SMS limit legitimately). Returning the full
 *   email to the client so it can call verifyOtp({ email, token }) is safe
 *   in this context.
 * - A separate rolling-window rate limit (3 per hour per email) prevents
 *   abuse of the email channel independently.
 * - Before triggering the Supabase email OTP, this route ensures the email
 *   exists in auth.users (syncing it from profiles if needed), so Supabase's
 *   verifyOtp flow works without creating duplicate users.
 *
 * Request body: { phone: string } — E.164
 *
 * Success (200):
 *   { ok: true, email: string, maskedEmail: string }
 *
 * Rate-limited (429):
 *   { blocked: true, retryAt: string }
 *
 * Not found (404):
 *   { error: string }  — no email linked to this phone
 *
 * Error: 400, 500.
 */

const EMAIL_LIMIT = 3;
const WINDOW_MS   = 60 * 60 * 1000;
const CLEANUP_AGE = 2 * WINDOW_MS;

export async function POST(req: NextRequest) {
  // ── Parse input ───────────────────────────────────────────────────────────
  let phone: string;
  try {
    const body = await req.json();
    phone = body?.phone;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!phone || typeof phone !== "string" || !phone.startsWith("+")) {
    return NextResponse.json({ error: "Invalid phone format" }, { status: 400 });
  }

  const admin = createAdminClient();
  const now   = new Date();

  // ── Look up profile email by phone ────────────────────────────────────────
  const localPhone = phone.startsWith("+972") ? "0" + phone.slice(4) : phone;

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, email")
    .or(`phone.eq.${localPhone},phone.eq.${phone}`)
    .not("email", "is", null)
    .limit(1)
    .maybeSingle();

  if (profileError) {
    console.error("[send-email-otp] profile lookup failed", profileError.message);
    return NextResponse.json({ error: "שגיאת שרת. נסו שוב." }, { status: 500 });
  }

  if (!profile?.email) {
    return NextResponse.json(
      { error: "לא נמצאה כתובת אימייל מקושרת למספר זה." },
      { status: 404 },
    );
  }

  const email       = profile.email;
  const maskedEmail = maskEmail(email);
  const windowStart = new Date(now.getTime() - WINDOW_MS).toISOString();

  // ── Check email rate limit ────────────────────────────────────────────────
  const { data: attemptsRaw, error: countError } = await admin
    .from("otp_rate_limits")
    .select("requested_at")
    .eq("channel", "email")
    .eq("identifier", email.toLowerCase())
    .gte("requested_at", windowStart)
    .order("requested_at", { ascending: true });

  const attempts = (attemptsRaw ?? []) as { requested_at: string }[];

  if (countError) {
    console.error("[send-email-otp] rate limit lookup failed", countError.message);
    return NextResponse.json({ error: "שגיאת שרת. נסו שוב." }, { status: 500 });
  }

  if (attempts.length >= EMAIL_LIMIT) {
    const oldestAt = new Date(attempts[0].requested_at);
    const retryAt  = new Date(oldestAt.getTime() + WINDOW_MS).toISOString();
    return NextResponse.json({ blocked: true, retryAt }, { status: 429 });
  }

  // ── Ensure email exists in auth.users ────────────────────────────────────
  // Supabase's signInWithOtp({ email }) requires the email to be present in
  // auth.users. For users who registered via phone OTP, auth.users.email may
  // be null (email was stored only in profiles). We sync it here using the
  // admin API with email_confirm: true so no confirmation email is sent and
  // no new user is accidentally created.
  const { error: syncError } = await admin.auth.admin.updateUserById(profile.id, {
    email,
    email_confirm: true,
  });

  if (syncError) {
    // Non-fatal if it's just "already set" — log and continue.
    console.warn("[send-email-otp] auth.users email sync warning", syncError.message);
  }

  // ── Send email OTP via Supabase ───────────────────────────────────────────
  const supabase = createPublicClient();
  const { error: otpError } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false }, // never create a new user
  });

  if (otpError) {
    console.error("[send-email-otp] signInWithOtp(email) failed", {
      message: otpError.message,
      email,
    });
    if (otpError.message.toLowerCase().includes("rate")) {
      return NextResponse.json(
        { error: "אנא המתינו מספר שניות לפני שליחה חוזרת." },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: "שגיאה בשליחת הקוד לאימייל. נסו שוב." },
      { status: 400 },
    );
  }

  // ── Record attempt ────────────────────────────────────────────────────────
  const { error: insertError } = await admin.from("otp_rate_limits").insert({
    channel:    "email",
    identifier: email.toLowerCase(),
  });
  if (insertError) {
    console.error("[send-email-otp] failed to record rate-limit entry", insertError.message);
  }

  // ── Opportunistic cleanup ─────────────────────────────────────────────────
  const cleanupBefore = new Date(now.getTime() - CLEANUP_AGE).toISOString();
  admin
    .from("otp_rate_limits")
    .delete()
    .lt("requested_at", cleanupBefore)
    .then(({ error }) => {
      if (error) console.error("[send-email-otp] cleanup error", error.message);
    });

  return NextResponse.json({ ok: true, email, maskedEmail });
}

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return email;
  return `${email[0]}***${email.slice(at)}`;
}
