"use client";

import { useState, useTransition } from "react";
import { Trash2, Loader2, AlertCircle } from "lucide-react";
import { deleteDeliveryZone } from "@/app/admin/delivery-zones/actions";
import { useRouter } from "next/navigation";

interface DeleteDeliveryZoneButtonProps {
  id: string;
  name: string;
}

export function DeleteDeliveryZoneButton({ id, name }: DeleteDeliveryZoneButtonProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleDelete = () => {
    setError("");
    startTransition(async () => {
      const result = await deleteDeliveryZone(id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => { setError(""); setOpen(true); }}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors cursor-pointer"
        aria-label={`מחק אזור משלוח ${name}`}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        מחק
      </button>

      {/* Confirm dialog */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={() => !isPending && setOpen(false)}
            aria-hidden="true"
          />

          {/* Dialog */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-zone-dialog-title"
            className="fixed z-50 inset-x-4 top-1/2 -translate-y-1/2 mx-auto w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6"
          >
            <div className="h-12 w-12 bg-red-50 rounded-xl flex items-center justify-center mb-4">
              <Trash2 className="h-6 w-6 text-red-500" aria-hidden="true" />
            </div>

            <h2 id="delete-zone-dialog-title" className="text-base font-bold text-gray-900 mb-1">
              מחיקת אזור משלוח
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              האם למחוק את אזור המשלוח{" "}
              <span className="font-semibold text-gray-800">&quot;{name}&quot;</span>?
              <br />
              פעולה זו אינה ניתנת לביטול.
            </p>

            {error && (
              <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 mb-4">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="flex-1 inline-flex items-center justify-center gap-2 h-10 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 disabled:opacity-60 transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  "אשר מחיקה"
                )}
              </button>
              <button
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                ביטול
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
