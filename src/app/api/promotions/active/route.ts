import { NextResponse } from "next/server";
import { fetchLivePromotions } from "@/lib/data/promotions";

/**
 * Public list of promotions that are live right now.
 *
 * Read by the guest cart so the drawer, cart page and checkout summary can show
 * the same saving the server will apply. It exposes nothing sensitive — the same
 * rows are already readable through the storefront's anon RLS policy.
 *
 * This response is advisory. Order totals are always recomputed server-side from
 * the database at checkout, so a cached, stale or tampered copy of this payload
 * can never influence what the customer is charged.
 */
export const revalidate = 60;

export async function GET() {
  const promotions = await fetchLivePromotions();

  return NextResponse.json(promotions, {
    headers: {
      // Short public cache: promotions change rarely, and a stale minute only
      // affects presentation.
      "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
