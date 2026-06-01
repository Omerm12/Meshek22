import { NextRequest, NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { getProductDisplay } from "@/lib/product-display";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json([]);
  }

  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("products")
    .select("id, name, slug, image_url, categories(name, slug)")
    .eq("is_active", true)
    .ilike("name", `%${q}%`)
    .order("sort_order", { ascending: true })
    .limit(8);

  if (error || !data) return NextResponse.json([]);

  return NextResponse.json(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data as any[]).map((p) => {
      const cat = Array.isArray(p.categories) ? p.categories[0] : p.categories;
      const display = getProductDisplay(p.slug as string);
      return {
        id: p.id as string,
        name: p.name as string,
        slug: p.slug as string,
        imageUrl: (p.image_url as string | null) ?? null,
        icon: display.icon,
        categoryName: (cat as { name: string } | null)?.name ?? "",
      };
    })
  );
}
