"use server";

import { createAdminClient } from "@/lib/supabase/server";
import type { DeliveryZone } from "@/lib/delivery";

export interface DeliverySettlement {
  name: string;
  delivery_zone_id: string | null;
}

export interface DeliveryGateData {
  zones: DeliveryZone[];
  settlements: DeliverySettlement[];
}

/**
 * Fetches zones + settlements from the database for the delivery gate modal.
 * Uses the same data source as the Delivery Areas page.
 */
export async function fetchDeliveryGateData(): Promise<DeliveryGateData> {
  const adminClient = await createAdminClient();

  const [zonesRes, settlementsRes] = await Promise.all([
    adminClient
      .from("delivery_zones")
      .select(
        "id, name, delivery_fee_agorot, free_delivery_threshold_agorot, min_order_agorot, estimated_delivery_hours"
      )
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    adminClient
      .from("settlements")
      .select("name, delivery_zone_id")
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);

  return {
    zones:       (zonesRes.data       ?? []) as DeliveryZone[],
    settlements: (settlementsRes.data ?? []) as DeliverySettlement[],
  };
}
