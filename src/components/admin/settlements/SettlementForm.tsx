"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { settlementSchema, type SettlementFormData } from "@/lib/validations/admin-settlement";
import type { ActionResult } from "@/app/admin/settlements/actions";

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({
  label,
  id,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  id: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ms-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

const inputClass =
  "w-full h-10 bg-white border border-gray-200 rounded-xl px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow";

const errorInputClass =
  "w-full h-10 bg-white border border-red-400 rounded-xl px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent transition-shadow";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DeliveryZoneOption {
  id: string;
  name: string;
}

interface SettlementFormProps {
  defaultValues?: Partial<SettlementFormData>;
  action: (formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  deliveryZones: DeliveryZoneOption[];
}

// ── Main component ────────────────────────────────────────────────────────────

export function SettlementForm({
  defaultValues,
  action,
  submitLabel,
  deliveryZones,
}: SettlementFormProps) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SettlementFormData>({
    resolver: zodResolver(settlementSchema),
    defaultValues: {
      name:             defaultValues?.name ?? "",
      delivery_zone_id: defaultValues?.delivery_zone_id ?? null,
      is_active:        defaultValues?.is_active ?? true,
    },
  });

  const onSubmit = (data: SettlementFormData) => {
    setServerError("");
    const fd = new FormData();
    fd.set("name",             data.name);
    fd.set("delivery_zone_id", data.delivery_zone_id ?? "");
    fd.set("is_active",        String(data.is_active));

    startTransition(async () => {
      const result = await action(fd);
      if (result && !result.success) {
        setServerError(result.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {/* Settlement name */}
      <Field label="שם היישוב" id="name" required error={errors.name?.message}>
        <input
          id="name"
          type="text"
          placeholder="תל אביב-יפו"
          {...register("name")}
          className={errors.name ? errorInputClass : inputClass}
        />
      </Field>

      {/* Delivery zone assignment */}
      <Field
        label="אזור משלוח"
        id="delivery_zone_id"
        hint="השאירו ריק אם היישוב אינו שייך לאף אזור משלוח"
        error={errors.delivery_zone_id?.message}
      >
        <select
          id="delivery_zone_id"
          {...register("delivery_zone_id")}
          className={[
            "w-full h-10 bg-white border rounded-xl px-3 text-sm text-gray-900",
            "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow",
            errors.delivery_zone_id ? "border-red-400" : "border-gray-200",
          ].join(" ")}
        >
          <option value="">— ללא אזור משלוח —</option>
          {deliveryZones.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.name}
            </option>
          ))}
        </select>
      </Field>

      {/* Is active */}
      <Field label="סטטוס" id="is_active">
        <div className="flex items-center gap-3 h-10">
          <input
            id="is_active"
            type="checkbox"
            {...register("is_active")}
            className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
          />
          <label
            htmlFor="is_active"
            className="text-sm text-gray-700 cursor-pointer select-none"
          >
            יישוב פעיל (זמין לבחירה בתהליך ההזמנה)
          </label>
        </div>
      </Field>

      {/* Server error */}
      {serverError && (
        <div className="flex items-start gap-2.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          {serverError}
        </div>
      )}

      {/* Submit */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 h-10 px-6 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60 transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          )}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
