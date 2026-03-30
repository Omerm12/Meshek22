import { NextResponse } from "next/server";
import { searchSettlements } from "@/lib/data/settlements";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  const results = searchSettlements(q);

  return NextResponse.json({ settlements: results });
}
