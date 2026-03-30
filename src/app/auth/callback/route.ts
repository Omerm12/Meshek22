import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/account";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Redirect to the requested page (or /account by default)
      const redirectTo = next.startsWith("/") ? `${origin}${next}` : `${origin}/account`;
      return NextResponse.redirect(redirectTo);
    }
  }

  // Auth failed — redirect to login with an error indicator
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
