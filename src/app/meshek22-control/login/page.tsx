import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin/auth";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";

export const metadata: Metadata = {
  title: "כניסה לניהול | משק 22",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  // Already signed in as an admin — skip the form.
  const admin = await getAdminUser();
  if (admin) redirect(ADMIN_ROUTES.dashboard);

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
