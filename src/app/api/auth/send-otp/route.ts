import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * POST /api/auth/send-otp
 *
 * Central server-side gate for all SMS OTP send requests.
 * Replaces direct client calls to supabase.auth.signInWithOtp({ phone }).
 *
 * Rate limit: 3 SMS sends per E.164 phone per rolling 60-minute window.
 *
 * Request body:
 *   { phone: string }            — E.164 format, e.g. "+972501234567"
 *   { isRegistration?: boolean } — true = sign-up flow; omit/false = login flow
 *
 * Success response (200):
 *   { ok: true }
 *
 * Rate-limited response (429):
 *   {
 *     blocked: true,
 *     retryAt: string,           — ISO timestamp: earliest time a new SMS can be sent
 *     hasEmailFallback: boolean,
 *     maskedEmail?: string,      — e.g. "u***@gmail.com" (display only)
 *     email?: string,            — full email (needed for verifyOtp on client)
 *   }
 *   email is returned only for login flow when an email address exists.
 *   It is safe to return because the caller already proved knowledge of the
 *   registered phone number (via check-phone) and triggered real OTP sends.
 *
 * Error responses: 400, 500.
 */

const SMS_LIMIT   = 3;
const WINDOW_MS   = 60 * 60 * 1000; // 1 hour in ms
const CLEANUP_AGE = 2 * WINDOW_MS;  // prune rows older than 2 hours

export async function POST(req: NextRequest) {
  // ── Parse and validate input ──────────────────────────────────────────────
  let phone: string;
  let isRegistration: boolean;

  try {
    const body = await req.json();
    phone          = body?.phone;
    isRegistration = Boolean(body?.isRegistration);

  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (typeof phone !== "string") {
    return NextResponse.json({ error: "Invalid phone format (E.164 required)" }, { status: 400 });
  }

  // Trim invisible whitespace that may come from form inputs or copy-paste.
  phone = phone.trim();

  if (!phone || !phone.startsWith("+")) {
    return NextResponse.json({ error: "Invalid phone format (E.164 required)" }, { status: 400 });
  }

  const admin = createAdminClient();
  const now   = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_MS).toISOString();

  // ── Check rolling-window rate limit ──────────────────────────────────────
  const { data: attemptsRaw, error: countError } = await admin
    .from("otp_rate_limits")
    .select("requested_at")
    .eq("channel", "sms")
    .eq("identifier", phone)
    .gte("requested_at", windowStart)
    .order("requested_at", { ascending: true });

  const attempts = (attemptsRaw ?? []) as { requested_at: string }[];

  if (countError) {
    console.error("[send-otp] rate limit lookup failed", countError.message);
    return NextResponse.json({ error: "שגיאת שרת. נסו שוב." }, { status: 500 });
  }

  if (attempts.length >= SMS_LIMIT) {
    // Oldest attempt in the window exits first; retryAt = that time + 1 hour.
    const oldestAt = new Date(attempts[0].requested_at);
    const retryAt  = new Date(oldestAt.getTime() + WINDOW_MS).toISOString();

    // Email fallback is offered only in the login flow, not during registration.
    let hasEmailFallback = false;
    let maskedEmail: string | undefined;
    let email: string | undefined;

    if (!isRegistration) {
      const { email: found, masked } = await lookupEmailByPhone(phone, admin);
      if (found) {
        hasEmailFallback = true;
        email            = found;
        maskedEmail      = masked;
      }
    }

    return NextResponse.json(
      { blocked: true, retryAt, hasEmailFallback, maskedEmail, email },
      { status: 429 },
    );
  }

  // ── Send OTP via Supabase ─────────────────────────────────────────────────
  // Use the public (anon-key) client — signInWithOtp is a public auth endpoint.
  const supabase = createPublicClient();
  const { error: otpError } = await supabase.auth.signInWithOtp({ phone });

  if (otpError) {
    console.error("[send-otp] signInWithOtp failed", {
      message: otpError.message,
      phone,
    });
    if (otpError.message.toLowerCase().includes("rate")) {
      // Supabase's own throttle (e.g. 60-second resend cooldown) — surface it.
      return NextResponse.json(
        { error: "אנא המתינו מספר שניות לפני שליחה חוזרת." },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: "שגיאה בשליחת הקוד. נסו שוב." },
      { status: 400 },
    );
  }

  // ── Record successful send ────────────────────────────────────────────────
  const insertResult = await admin.from("otp_rate_limits").insert({
    channel:    "sms",
    identifier: phone,
  });
  if (insertResult.error) {
    // Non-fatal: the OTP was sent. Log and continue.
    console.error("[send-otp] failed to record rate-limit entry", insertResult.error.message);
  }

  // ── Opportunistic cleanup (fire-and-forget) ───────────────────────────────
  // Delete rows older than 2 hours to keep the table from growing unbounded.
  const cleanupBefore = new Date(now.getTime() - CLEANUP_AGE).toISOString();
  admin
    .from("otp_rate_limits")
    .delete()
    .lt("requested_at", cleanupBefore)
    .then(({ error }) => {
      if (error) console.error("[send-otp] cleanup error", error.message);
    });

  return NextResponse.json({ ok: true });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Look up a user's email from the profiles table by phone number.
 * profiles.phone is stored in local Israeli format (0501234567), so we
 * derive both the local and E.164 forms and query for either.
 */
async function lookupEmailByPhone(
  e164Phone: string,
  admin: AdminClient,
): Promise<{ email: string; masked: string } | { email: null; masked: null }> {
  const localPhone = e164Phone.startsWith("+972")
    ? "0" + e164Phone.slice(4)
    : e164Phone;

  const { data } = await admin
    .from("profiles")
    .select("email")
    .or(`phone.eq.${localPhone},phone.eq.${e164Phone}`)
    .not("email", "is", null)
    .limit(1)
    .maybeSingle();

  if (!data?.email) return { email: null, masked: null };

  return {
    email:  data.email,
    masked: maskEmail(data.email),
  };
}

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return email;
  const local  = email.slice(0, at);
  const domain = email.slice(at);
  return `${local[0]}***${domain}`;
}
