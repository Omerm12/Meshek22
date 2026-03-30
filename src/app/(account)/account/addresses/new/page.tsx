import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AddressForm } from "@/components/account/AddressForm";

export const metadata: Metadata = {
  title: "כתובת חדשה",
};

export default function NewAddressPage() {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-6">
        <Link href="/account/addresses" className="hover:text-brand-700 transition-colors">
          כתובות משלוח
        </Link>
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
        <span className="text-gray-700 font-medium">כתובת חדשה</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">הוספת כתובת</h1>

      <div className="bg-white rounded-2xl border border-stone-100 p-6 max-w-md">
        <AddressForm />
      </div>
    </div>
  );
}
