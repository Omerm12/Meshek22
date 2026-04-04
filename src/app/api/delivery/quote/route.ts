import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getDeliveryQuote } from "@/lib/delivery";
import type { DeliveryZone } from "@/lib/delivery";

export async function POST(request: Request) {
  let body: { zoneId?: string; city?: string; subtotalAgorot?: number };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { zoneId, city, subtotalAgorot = 0 } = body;

  const adminClient = await createAdminClient();
  let resolvedZoneId = zoneId;

  // If no zoneId but city provided, look up from settlements table
  if (!resolvedZoneId && city) {
    const { data: settlement } = await adminClient
      .from("settlements")
      .select("delivery_zone_id")
      .eq("name", city)
      .eq("is_active", true)
      .maybeSingle();
    resolvedZoneId = settlement?.delivery_zone_id ?? undefined;
  }

  if (!resolvedZoneId) {
    return NextResponse.json({ error: "City or zone not found" }, { status: 404 });
  }

  const { data: zone, error } = await adminClient
    .from("delivery_zones")
    .select("id, name, delivery_fee_agorot, free_delivery_threshold_agorot, min_order_agorot, estimated_delivery_hours")
    .eq("id", resolvedZoneId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !zone) {
    return NextResponse.json({ error: "Zone not found" }, { status: 404 });
  }

  const quote = getDeliveryQuote(zone as DeliveryZone, subtotalAgorot);

  return NextResponse.json({ quote });
}
