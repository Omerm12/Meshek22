"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  deliveryZoneSchema,
  DELIVERY_DAYS_OPTIONS,
  type DeliveryZoneFormData,
} from "@/lib/validations/admin-delivery-zone";
import { slugify } from "@/lib/utils/slugify";
import type { ActionResult } from "@/app/admin/delivery-zones/actions";

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

// ── Main component ────────────────────────────────────────────────────────────

interface DeliveryZoneFormProps {
  defaultValues?: Partial<DeliveryZoneFormData>;
  action: (formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
}

export function DeliveryZoneForm({
  defaultValues,
  action,
  submitLabel,
}: DeliveryZoneFormProps) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(!!defaultValues?.slug);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<DeliveryZoneFormData>({
    resolver: zodResolver(deliveryZoneSchema),
    defaultValues: {
      name:                             defaultValues?.name ?? "",
      slug:                             defaultValues?.slug ?? "",
      description:                      defaultValues?.description ?? "",
      delivery_fee_shekel:              defaultValues?.delivery_fee_shekel ?? 0,
      min_order_shekel:                 defaultValues?.min_order_shekel ?? null,
      free_delivery_threshold_shekel:   defaultValues?.free_delivery_threshold_shekel ?? null,
      delivery_days:                    defaultValues?.delivery_days ?? [
        "ראשון", "שני", "שלישי", "רביעי", "חמישי",
      ],
      estimated_delivery_hours:         defaultValues?.estimated_delivery_hours ?? 24,
      is_active:                        defaultValues?.is_active ?? true,
      sort_order:                       defaultValues?.sort_order ?? 0,
    },
  });

  // Auto-generate slug from name
  const nameValue = watch("name");
  useEffect(() => {
    if (!slugManuallyEdited) {
      setValue("slug", slugify(nameValue), { shouldValidate: false });
    }
  }, [nameValue, slugManuallyEdited, setValue]);

  const onSubmit = (data: DeliveryZoneFormData) => {
    setServerError("");
    const fd = new FormData();
    fd.set("name",                 data.name);
    fd.set("slug",                 data.slug);
    fd.set("description",          data.description ?? "");
    fd.set("delivery_fee_shekel",  String(data.delivery_fee_shekel));
    fd.set("min_order_shekel",     data.min_order_shekel != null ? String(data.min_order_shekel) : "");
    fd.set(
      "free_delivery_threshold_shekel",
      data.free_delivery_threshold_shekel != null
        ? String(data.free_delivery_threshold_shekel)
        : ""
    );
    // delivery_days as repeated entries
    data.delivery_days.forEach((day) => fd.append("delivery_days", day));
    fd.set(
      "estimated_delivery_hours",
      data.estimated_delivery_hours != null ? String(data.estimated_delivery_hours) : ""
    );
    fd.set("is_active",   String(data.is_active));
    fd.set("sort_order",  String(data.sort_order));

    startTransition(async () => {
      const result = await action(fd);
      if (result && !result.success) {
        setServerError(result.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {/* Name */}
      <Field label="שם אזור המשלוח" id="name" required error={errors.name?.message}>
        <input
          id="name"
          type="text"
          placeholder="מרכז תל אביב"
          {...register("name")}
          className={errors.name ? errorInputClass : inputClass}
        />
      </Field>

      {/* Slug */}
      <Field
        label="Slug (מזהה ב-URL)"
        id="slug"
        required
        hint="אותיות לועזיות, ספרות ומקפים בלבד"
        error={errors.slug?.message}
      >
        <input
          id="slug"
          type="text"
          dir="ltr"
          placeholder="tel-aviv-center"
          {...register("slug", {
            onChange: () => setSlugManuallyEdited(true),
          })}
          className={errors.slug ? errorInputClass : inputClass}
        />
      </Field>

      {/* Description */}
      <Field label="תיאור" id="description" error={errors.description?.message}>
        <textarea
          id="description"
          rows={2}
          placeholder="תיאור קצר של אזור המשלוח..."
          {...register("description")}
          className={[
            "w-full bg-white border rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400",
            "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow resize-none",
            errors.description ? "border-red-400" : "border-gray-200",
          ].join(" ")}
        />
      </Field>

      {/* Monetary fields */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field
          label="דמי משלוח (₪)"
          id="delivery_fee_shekel"
          required
          error={errors.delivery_fee_shekel?.message}
        >
          <div className="relative">
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">
              ₪
            </span>
            <input
              id="delivery_fee_shekel"
              type="number"
              step="0.01"
              min="0"
              dir="ltr"
              {...register("delivery_fee_shekel", { valueAsNumber: true })}
              className={[
                errors.delivery_fee_shekel ? errorInputClass : inputClass,
                "pr-8",
              ].join(" ")}
            />
          </div>
        </Field>

        <Field
          label="מינימום הזמנה (₪)"
          id="min_order_shekel"
          hint="השאירו ריק אם אין מינימום הזמנה"
          error={errors.min_order_shekel?.message}
        >
          <div className="relative">
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">
              ₪
            </span>
            <Controller
              name="min_order_shekel"
              control={control}
              render={({ field }) => (
                <input
                  id="min_order_shekel"
                  type="number"
                  step="0.01"
                  min="0"
                  dir="ltr"
                  placeholder="ריק = ללא מינימום"
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(e.target.value === "" ? null : parseFloat(e.target.value))
                  }
                  className={[
                    errors.min_order_shekel ? errorInputClass : inputClass,
                    "pr-8",
                  ].join(" ")}
                />
              )}
            />
          </div>
        </Field>

        <Field
          label="משלוח חינם מ-(₪)"
          id="free_delivery_threshold_shekel"
          hint="השאירו ריק אם אין סף"
          error={errors.free_delivery_threshold_shekel?.message}
        >
          <div className="relative">
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">
              ₪
            </span>
            <Controller
              name="free_delivery_threshold_shekel"
              control={control}
              render={({ field }) => (
                <input
                  id="free_delivery_threshold_shekel"
                  type="number"
                  step="0.01"
                  min="0"
                  dir="ltr"
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(e.target.value === "" ? null : parseFloat(e.target.value))
                  }
                  className={[
                    errors.free_delivery_threshold_shekel ? errorInputClass : inputClass,
                    "pr-8",
                  ].join(" ")}
                />
              )}
            />
          </div>
        </Field>
      </div>

      {/* Delivery days */}
      <Field
        label="ימי משלוח"
        id="delivery_days"
        required
        error={errors.delivery_days?.message}
      >
        <Controller
          name="delivery_days"
          control={control}
          render={({ field }) => (
            <div className="flex flex-wrap gap-2 pt-1">
              {DELIVERY_DAYS_OPTIONS.map((day) => {
                const selected = field.value?.includes(day) ?? false;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      const current = field.value ?? [];
                      field.onChange(
                        selected
                          ? current.filter((d) => d !== day)
                          : [...current, day]
                      );
                    }}
                    className={[
                      "h-9 px-3.5 rounded-xl text-sm font-medium border transition-colors cursor-pointer",
                      selected
                        ? "bg-brand-600 text-white border-brand-600"
                        : "bg-white text-gray-600 border-gray-200 hover:border-brand-400 hover:text-brand-700",
                    ].join(" ")}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          )}
        />
      </Field>

      {/* Estimated delivery hours + Sort order */}
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="זמן אספקה משוער (שעות)"
          id="estimated_delivery_hours"
          hint="לדוגמה: 24 = יום עסקים"
          error={errors.estimated_delivery_hours?.message}
        >
          <Controller
            name="estimated_delivery_hours"
            control={control}
            render={({ field }) => (
              <input
                id="estimated_delivery_hours"
                type="number"
                min="1"
                dir="ltr"
                value={field.value ?? ""}
                onChange={(e) =>
                  field.onChange(e.target.value === "" ? null : parseInt(e.target.value, 10))
                }
                className={
                  errors.estimated_delivery_hours ? errorInputClass : inputClass
                }
              />
            )}
          />
        </Field>

        <Field
          label="סדר מיון"
          id="sort_order"
          required
          error={errors.sort_order?.message}
        >
          <input
            id="sort_order"
            type="number"
            min="0"
            dir="ltr"
            {...register("sort_order", { valueAsNumber: true })}
            className={errors.sort_order ? errorInputClass : inputClass}
          />
        </Field>
      </div>

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
            אזור פעיל (יוצג בתהליך ההזמנה)
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
