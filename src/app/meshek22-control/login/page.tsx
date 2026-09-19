import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { getAdminUser } from "@/lib/admin/auth";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";

export const metadata: Metadata = {
  title: "כניסה לניהול | משק 22",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ reason?: string }>;
}

export default async function AdminLoginPage({ searchParams }: PageProps) {
  // Already signed in as an admin — skip the form.
  const admin = await getAdminUser();
  if (admin) redirect(ADMIN_ROUTES.dashboard);

  // Set by the middleware when it cleared an invalid/rejected Supabase
  // refresh token — see updateSession() in src/lib/supabase/middleware.ts.
  // Not a login failure, so it's shown here rather than inside
  // AdminLoginForm's own (login-attempt-scoped) error slot.
  const { reason } = await searchParams;
  const sessionExpired = reason === "session_expired";

  return (
    <main className="min-h-screen flex items-center justify-center bg-stone-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/images/heroes/logo.png"
            alt="משק 22"
            width={160}
            height={70}
            className="h-16 w-auto object-contain"
            priority
          />
          <p className="mt-3 text-sm text-stone-500">כניסה לפורטל הניהול</p>
        </div>

        {sessionExpired && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>פג תוקף החיבור. יש להתחבר מחדש.</span>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 sm:p-8">
          <h1 className="text-xl font-bold text-gray-900 mb-6">התחברות</h1>
          <AdminLoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-stone-400 leading-relaxed">
          האזור מיועד לצוות משק 22 בלבד.
        </p>
      </div>
    </main>
  );
}
