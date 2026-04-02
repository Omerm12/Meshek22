import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShoppingCart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { CheckoutLoginGate } from "@/components/checkout/CheckoutLoginGate";
import { Container } from "@/components/ui/Container";
import type { Database } from "@/types/database";

export const metadata: Metadata = {
  title: "קופה | משק 22",
};

type AddressRow = Database["public"]["Tables"]["addresses"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export default async function CheckoutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not authenticated — show a friendly gate with a modal trigger instead
  // of a hard redirect. After login the client calls router.refresh() which
  // re-runs this server component with the active session.
  if (!user) {
    return <CheckoutLoginGate />;
  }

  const [addrRes, profileRes] = await Promise.all([
    supabase
      .from("addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("*").eq("id", user.id).single(),
  ]);

  const addresses = (addrRes.data ?? []) as AddressRow[];
  const profile = (profileRes.data as ProfileRow | null) ?? null;

  return (
    <main className="flex-1 py-8 lg:py-12" style={{ backgroundColor: "var(--color-surface)" }}>
      <Container>
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-stone-500 mb-6" aria-label="פירורי לחם">
          <Link href="/cart" className="flex items-center gap-1 hover:text-brand-700 transition-colors">
            <ShoppingCart className="h-3.5 w-3.5" />
            סל קניות
          </Link>
          <ArrowRight className="h-3.5 w-3.5 rotate-180 text-stone-300" aria-hidden="true" />
          <span className="font-medium text-gray-900">קופה</span>
        </nav>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">סיום ותשלום</h1>

        <CheckoutForm
          addresses={addresses}
          profile={profile}
          userEmail={user.email ?? null}
        />
      </Container>
    </main>
  );
}
