import { NextResponse } from "next/server";
import { getDeliveryQuote, findZoneByCity, DELIVERY_ZONES } from "@/lib/delivery";

export async function POST(request: Request) {
  let body: { city?: string; zoneSlug?: string; subtotalAgorot?: number };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { city, zoneSlug, subtotalAgorot = 0 } = body;

  let resolvedZoneSlug = zoneSlug;

  if (!resolvedZoneSlug && city) {
    const zone = findZoneByCity(city);
    resolvedZoneSlug = zone?.slug;
  }

  if (!resolvedZoneSlug || !DELIVERY_ZONES[resolvedZoneSlug]) {
    return NextResponse.json({ error: "City or zone not found" }, { status: 404 });
  }

  const quote = getDeliveryQuote(resolvedZoneSlug, subtotalAgorot);

  return NextResponse.json({ quote });
}
