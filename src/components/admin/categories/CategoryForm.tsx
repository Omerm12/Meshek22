"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { categorySchema, type CategoryFormData } from "@/lib/validations/admin-category";
import { slugify } from "@/lib/utils/slugify";
import type { ActionResult } from "@/app/admin/categories/actions";

interface CategoryFormProps {
  /** Pre-filled values for edit mode. Omit for create mode. */
  defaultValues?: Partial<CategoryFormData>;
  /** The server action to call on submit. */
  action: (formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
}

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

export function CategoryForm({ defaultValues, action, submitLabel }: CategoryFormProps) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(
    // In edit mode the slug is pre-set; treat it as manually set so auto-gen doesn't overwrite
    !!defaultValues?.slug
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name:        defaultValues?.name        ?? "",
      slug:        defaultValues?.slug        ?? "",
      description: defaultValues?.description ?? "",
      image_url:   defaultValues?.image_url   ?? "",
      sort_order:  defaultValues?.sort_order  ?? 0,
      is_active:   defaultValues?.is_active   ?? true,
    },
  });

  // Auto-generate slug from name (only if the user hasn't manually edited it)
  const nameValue = watch("name");
  useEffect(() => {
    if (!slugManuallyEdited) {
      setValue("slug", slugify(nameValue), { shouldValidate: false });
    }
  }, [nameValue, slugManuallyEdited, setValue]);

  const onSubmit = (data: CategoryFormData) => {
    setServerError("");
    const fd = new FormData();
    fd.set("name",        data.name);
    fd.set("slug",        data.slug);
    fd.set("description", data.description ?? "");
    fd.set("image_url",   data.image_url ?? "");
    fd.set("sort_order",  String(data.sort_order));
    fd.set("is_active",   String(data.is_active));

    startTransition(async () => {
      const result = await action(fd);
      // If result returns (i.e., no redirect), it means an error occurred.
      if (result && !result.success) {
        setServerError(result.error);
      }
      // On success, the server action calls redirect() — no need to handle here.
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {/* Name */}
      <Field label="שם הקטגוריה" id="name" required error={errors.name?.message}>
        <input
          id="name"
          type="text"
          placeholder="ירקות טריים"
          {...register("name")}
          className={errors.name ? errorInputClass : inputClass}
        />
      </Field>

      {/* Slug */}
      <Field
        label="Slug (מזהה ב-URL)"
        id="slug"
        required
        hint="מוצג ב-URL: /category/slug — ניתן לשנות, אותיות לועזיות, ספרות ומקפים בלבד"
        error={errors.slug?.message}
      >
        <input
          id="slug"
          type="text"
          dir="ltr"
          placeholder="yerakot"
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
          rows={3}
          placeholder="תיאור קצר של הקטגוריה..."
          {...register("description")}
          className={[
            "w-full bg-white border rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400",
            "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow resize-none",
            errors.description ? "border-red-400" : "border-gray-200",
          ].join(" ")}
        />
      </Field>

      {/* Image URL */}
      <Field
        label="כתובת תמונה (URL)"
        id="image_url"
        hint="לא חובה — URL של תמונה מייצגת"
        error={errors.image_url?.message}
      >
        <input
          id="image_url"
          type="url"
          dir="ltr"
          placeholder="https://..."
          {...register("image_url")}
          className={errors.image_url ? errorInputClass : inputClass}
        />
      </Field>

      {/* Sort order + Is active — side by side */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="סדר מיון" id="sort_order" required error={errors.sort_order?.message}>
          <input
            id="sort_order"
            type="number"
            min={0}
            dir="ltr"
            {...register("sort_order", { valueAsNumber: true })}
            className={errors.sort_order ? errorInputClass : inputClass}
          />
        </Field>

        <Field label="סטטוס" id="is_active">
          <div className="flex items-center gap-3 h-10">
            <input
              id="is_active"
              type="checkbox"
              {...register("is_active")}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700 cursor-pointer select-none">
              פעילה
            </label>
          </div>
        </Field>
      </div>

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
