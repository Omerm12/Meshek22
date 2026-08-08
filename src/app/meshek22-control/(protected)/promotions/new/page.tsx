import type { Metadata } from "next";
import Link from "next/link";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { PromotionForm } from "@/components/admin/promotions/PromotionForm";
import { createPromotion } from "@/app/meshek22-control/(protected)/promotions/actions";

export const metadata: Metadata = { title: "מבצע חדש" };

export default function NewPromotionPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <nav className="flex items-center gap-1.5 text-sm text-gray-400" aria-label="פירורי לחם">
        <Link href={ADMIN_ROUTES.promotions} className="hover:text-gray-700 transition-colors">
          מבצעים
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-gray-700 font-medium">מבצע חדש</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900">מבצע חדש</h1>

      <PromotionForm
        action={createPromotion}
        submitLabel="יצירת מבצע"
        initialValues={{
          name: "",
          description: "",
          requiredQuantity: 4,
          bundlePriceShekels: 10,
          isActive: true,
          startsAt: "",
          endsAt: "",
          sortOrder: 0,
          selectedVariants: [],
        }}
      />
    </div>
  );
}
