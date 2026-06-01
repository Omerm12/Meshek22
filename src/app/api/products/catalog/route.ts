import { NextResponse } from "next/server";
import { fetchAllProducts } from "@/lib/data/storefront";

// ISR: rebuild the catalog response at most once per minute
export const revalidate = 60;

export async function GET() {
  const products = await fetchAllProducts();
  return NextResponse.json(products, {
    headers: {
      // Also instruct the browser to cache for 60 s and serve stale for 5 min
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
