import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/check-phone
 *
 * Checks whether a phone number already has a profile in the system.
 * Used by the login/register forms BEFORE sending an OTP, so we can
 * gate the correct flow on the correct tab.
 *
 * Body: { phone: string }  — E.164 format, e.g. "+972504083515"
 * Response: { exists: boolean }
 *
 * Uses the admin (service-role) client to bypass RLS, since anonymous
 * users cannot query the profiles table.
 *
 * profiles.phone is stored in local Israeli format (0501234567), so we
 * derive the local format from E.164 and query both to be safe.
 */
export async function POST(req: NextRequest) {
  let phone: string;

  try {
    const body = await req.json();
    phone = body?.phone;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!phone || typeof phone !== "string" || !phone.startsWith("+")) {
    return NextResponse.json({ error: "Invalid phone" }, { status: 400 });
  }

  // Derive local Israeli format from E.164: +972504083515 → 0504083515
  const localPhone = phone.startsWith("+972")
    ? "0" + phone.slice(4)
    : phone;

  try {
    const supabase = await createAdminClient();

    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .or(`phone.eq.${localPhone},phone.eq.${phone}`)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[check-phone] DB error:", error.message);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    return NextResponse.json({ exists: data !== null });
  } catch (err) {
    console.error("[check-phone] Unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
