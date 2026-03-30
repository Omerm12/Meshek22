"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { MapPin, Star, Pencil, Trash2 } from "lucide-react";
import { deleteAddress, setDefaultAddress } from "@/app/(account)/actions";
import type { Database } from "@/types/database";

type AddressRow = Database["public"]["Tables"]["addresses"]["Row"];

interface AddressCardProps {
  address: AddressRow;
}

export function AddressCard({ address }: AddressCardProps) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const handleDelete = () => {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    startTransition(() => deleteAddress(address.id));
  };

  const handleSetDefault = () => {
    startTransition(() => setDefaultAddress(address.id));
  };

  const lines = [
    `${address.street} ${address.house_number}`,
    address.apartment,
    address.city,
    address.zip_code,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      className={[
        "bg-white rounded-2xl border p-5 transition-shadow",
        address.is_default ? "border-brand-200 shadow-sm" : "border-stone-100",
        isPending ? "opacity-60 pointer-events-none" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={[
              "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
              address.is_default ? "bg-brand-50" : "bg-stone-100",
            ].join(" ")}
          >
            <MapPin
              className={[
                "h-4 w-4",
                address.is_default ? "text-brand-600" : "text-stone-400",
              ].join(" ")}
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {address.label && (
                <span className="font-semibold text-gray-900 text-sm">
                  {address.label}
                </span>
              )}
              {address.is_default && (
                <span className="flex items-center gap-1 text-xs font-bold text-brand-700 bg-brand-50 rounded-full px-2.5 py-0.5">
                  <Star className="h-3 w-3 fill-current" aria-hidden="true" />
                  ברירת מחדל
                </span>
              )}
            </div>
            <p className="text-sm text-stone-600 mt-0.5 leading-snug">{lines}</p>
            {address.notes && (
              <p className="text-xs text-stone-400 mt-1 leading-snug">{address.notes}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <Link
            href={`/account/addresses/${address.id}/edit`}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
            aria-label="ערכו כתובת"
          >
            <Pencil className="h-4 w-4" />
          </Link>
          <button
            onClick={handleDelete}
            aria-label={confirming ? "לחצו שוב לאישור מחיקה" : "מחקו כתובת"}
            className={[
              "h-8 w-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer text-sm",
              confirming
                ? "bg-red-500 text-white"
                : "text-stone-400 hover:text-red-500 hover:bg-red-50",
            ].join(" ")}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!address.is_default && (
        <button
          onClick={handleSetDefault}
          className="mt-3 text-xs text-stone-400 hover:text-brand-600 transition-colors cursor-pointer"
        >
          הגדרו כברירת מחדל
        </button>
      )}
    </div>
  );
}
