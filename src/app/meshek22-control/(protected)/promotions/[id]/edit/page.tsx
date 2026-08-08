import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { PromotionForm } from "@/components/admin/promotions/PromotionForm";
import { updatePromotion } from "@/app/meshek22-control/(protected)/promotions/actions";
import type { PromotionVariantOption } from "@/app/meshek22-control/(protected)/promotions/actions";

export const metadata: Metadata = { title: "עריכת מבצע" };
export const dynamic = "force-dynamic";

/** Postgres timestamptz → the "YYYY-MM-DDTHH:mm" that datetime-local expects. */
function toDateTimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function EditPromotionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();

  const { data: promotion } = await db
    .from("promotions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!promotion) notFound();

  // Load the currently selected variants with enough detail to render the chips.
  const { data: items } = await db
    .from("promotion_items")
    .select(
      "product_variant_id, product_variants!inner(id, label, price_agorot, quantity_pricing_mode, products!inner(id, name))"
    )
    .eq("promotion_id", id);

  type ItemRow = {
    product_variants: {
      id: string;
      label: string;
      price_agorot: number;
      quantity_pricing_mode: "fixed" | "per_kg";
      products: { id: string; name: string };
    };
  };

  const selectedVariants: PromotionVariantOption[] = ((items ?? []) as unknown as ItemRow[]).map(
    (row) => ({
      variantId:    row.product_variants.id,
      variantLabel: row.product_variants.label,
      productId:    row.product_variants.products.id,
      productName:  row.product_variants.products.name,
      priceAgorot:  row.product_variants.price_agorot,
      isPerKg:      row.product_variants.quantity_pricing_mode === "per_kg",
    })
  );

  // Bind the promotion id so the client component keeps a plain FormData action.
  const action = updatePromotion.bind(null, id);

  return (
    <div className="space-y-6 max-w-3xl">
      <nav className="flex items-center gap-1.5 text-sm text-gray-400" aria-label="פירורי לחם">
        <Link href={ADMIN_ROUTES.promotions} className="hover:text-gray-700 transition-colors">
          מבצעים
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-gray-700 font-medium">עריכה</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900">עריכת מבצע</h1>

      <PromotionForm
        action={action}
        submitLabel="שמירת שינויים"
        initialValues={{
          name:               promotion.name,
          description:        promotion.description ?? "",
          requiredQuantity:   promotion.required_quantity,
          bundlePriceShekels: promotion.bundle_price_agorot / 100,
          isActive:           promotion.is_active,
          startsAt:           toDateTimeLocal(promotion.starts_at),
          endsAt:             toDateTimeLocal(promotion.ends_at),
          sortOrder:          promotion.sort_order,
          selectedVariants,
        }}
      />
    </div>
  );
}
