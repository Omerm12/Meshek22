import Link from "next/link";
import { Leaf } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // If already logged in, redirect to account
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/account");
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ backgroundColor: "var(--color-surface)" }}
    >
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 mb-8 group">
        <div className="h-9 w-9 rounded-xl bg-brand-600 flex items-center justify-center shadow-sm group-hover:bg-brand-700 transition-colors">
          <Leaf className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <span className="text-xl font-bold text-gray-900">משק 22</span>
      </Link>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl border border-stone-100 shadow-sm p-8">
        {children}
      </div>

      <p className="mt-6 text-xs text-stone-400 text-center max-w-xs leading-relaxed">
        בכניסה לאתר הנכם מסכימים ל
        <Link href="/privacy" className="underline underline-offset-2 hover:text-stone-600">
          מדיניות הפרטיות
        </Link>
        {" "}ול
        <Link href="/terms" className="underline underline-offset-2 hover:text-stone-600">
          תנאי השימוש
        </Link>
      </p>
    </div>
  );
}
