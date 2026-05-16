import type { Metadata } from "next";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { ArrowRight, ShoppingCart } from "lucide-react";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { CheckoutLoginGate } from "@/components/checkout/CheckoutLoginGate";
import { Container } from "@/components/ui/Container";
import type { Database } from "@/types/database";
import type { DeliveryZone } from "@/lib/delivery";

export const metadata: Metadata = {
  title: "קופה | משק 22",
};

type AddressRow = Database["public"]["Tables"]["addresses"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export interface CheckoutSettlement {
  name: string;
  delivery_zone_id: string | null;
}

// Delivery zones and settlements change only when an admin updates them.
// Cache for 5 minutes so repeated checkout visits don't hit Supabase on every request.
// Tag 'delivery-zones' lets admin actions call revalidateTag('delivery-zones') on zone updates.
const getCachedDeliveryData = unstable_cache(
  async (): Promise<{ zones: DeliveryZone[]; settlements: CheckoutSettlement[] }> => {
    const admin = createAdminClient();
    const [zonesRes, settlementsRes] = await Promise.all([
      admin
        .from("delivery_zones")
        .select(
          "id, name, delivery_fee_agorot, free_delivery_threshold_agorot, min_order_agorot, estimated_delivery_hours"
        )
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      admin
        .from("settlements")
        .select("name, delivery_zone_id")
        .eq("is_active", true)
        .order("name", { ascending: true }),
    ]);
    return {
      zones:       (zonesRes.data       ?? []) as DeliveryZone[],
      settlements: (settlementsRes.data ?? []) as CheckoutSettlement[],
    };
  },
  ["checkout-delivery-data"],
  { revalidate: 300, tags: ["delivery-zones"] }
);

export default async function CheckoutPage() {
  const supabase = await createClient();

  // Kick off the (cached) delivery data fetch immediately — it does not depend on
  // auth, so it runs concurrently with getUser() and saves ~100–300 ms per visit.
  const deliveryDataPromise = getCachedDeliveryData();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <CheckoutLoginGate />;
  }

  // User-specific queries + delivery data all in parallel.
  const [addrRes, profileRes, { zones: deliveryZones, settlements }] = await Promise.all([
    supabase
      .from("addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    deliveryDataPromise,
  ]);

  const addresses     = (addrRes.data                     ?? []) as AddressRow[];
  const profile       = (profileRes.data as ProfileRow | null) ?? null;

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
          deliveryZones={deliveryZones}
          settlements={settlements}
        />
      </Container>
    </main>
  );
}
