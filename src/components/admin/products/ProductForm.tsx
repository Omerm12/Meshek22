"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { productFormSchema, type ProductFormData } from "@/lib/validations/admin-product";
import { slugify } from "@/lib/utils/slugify";
import { VariantFields } from "@/components/admin/products/VariantFields";
import { ProductImageUpload } from "@/components/admin/products/ProductImageUpload";
import type { ActionResult } from "@/app/admin/products/actions";

export interface CategoryOption {
  id:        string;
  name:      string;
  parent_id: string | null;
}

interface ProductFormProps {
  defaultValues?: Partial<ProductFormData>;
  action:         (formData: FormData) => Promise<ActionResult>;
  submitLabel:    string;
  categories:     CategoryOption[];
}

// ─── Shared input styles ───────────────────────────────────────────────────────

const inputCls =
  "w-full h-10 bg-white border border-gray-200 rounded-xl px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow";
const errInputCls =
  "w-full h-10 bg-white border border-red-400 rounded-xl px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent transition-shadow";

function Field({
  label, id, error, hint, required, children,
}: {
  label: string; id: string; error?: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ms-0.5">*</span>}
      </label>
      {children}
      {hint  && !error && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
      {error &&           <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

/**
 * Build grouped category options for the <select>.
 *
 * Returns an array of either:
 *   { type: "group"; parentName: string; options: CategoryOption[] }
 *   { type: "option"; cat: CategoryOption }   ← for root-level categories with no children
 */
type GroupedCategories =
  | { type: "group"; parentName: string; options: CategoryOption[] }
  | { type: "option"; cat: CategoryOption };

function buildGroupedCategories(categories: CategoryOption[]): GroupedCategories[] {
  const topLevel   = categories.filter((c) => !c.parent_id);
  const children   = categories.filter((c) => !!c.parent_id);
  const byParentId = new Map<string, CategoryOption[]>();

  for (const child of children) {
    if (!byParentId.has(child.parent_id!)) byParentId.set(child.parent_id!, []);
    byParentId.get(child.parent_id!)!.push(child);
  }

  const result: GroupedCategories[] = [];

  for (const parent of topLevel) {
    const kids = byParentId.get(parent.id);
    if (kids && kids.length > 0) {
      result.push({ type: "group", parentName: parent.name, options: kids });
    } else {
      // Top-level with no children → show as a standalone option
      result.push({ type: "option", cat: parent });
    }
  }

  // Orphaned children (parent inactive or missing)
  const knownParentIds = new Set(topLevel.map((c) => c.id));
  const orphans = children.filter((c) => !knownParentIds.has(c.parent_id!));
  if (orphans.length > 0) {
    result.push({ type: "group", parentName: "אחר", options: orphans });
  }

  return result;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductForm({ defaultValues, action, submitLabel, categories }: ProductFormProps) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState("");
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(!!defaultValues?.slug);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      category_id:  defaultValues?.category_id  ?? "",
      name:         defaultValues?.name          ?? "",
      slug:         defaultValues?.slug          ?? "",
      description:  defaultValues?.description   ?? "",
      image_url:    defaultValues?.image_url     ?? "",
      is_active:    defaultValues?.is_active     ?? true,
      is_featured:  defaultValues?.is_featured   ?? false,
      sort_order:   defaultValues?.sort_order    ?? 0,
      variants:     defaultValues?.variants      ?? [
        { unit: "unit", label: "יחידה", price: 0, compare_price: null, stock_quantity: null, is_available: true, is_default: true, sort_order: 0 },
      ],
    },
  });

  // Watch image_url for the upload component preview
  const imageUrlValue = watch("image_url") ?? "";

  // Auto-generate slug from name
  const nameValue = watch("name");
  useEffect(() => {
    if (!slugManuallyEdited) {
      setValue("slug", slugify(nameValue), { shouldValidate: false });
    }
  }, [nameValue, slugManuallyEdited, setValue]);

  const onSubmit = (data: ProductFormData) => {
    setServerError("");
    const fd = new FormData();
    fd.set("data", JSON.stringify(data));

    startTransition(async () => {
      const result = await action(fd);
      if (result && !result.success) {
        setServerError(result.error);
      }
    });
  };

  const grouped = buildGroupedCategories(categories);

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">

      {/* ── Product fields ────────────────────────────────────────────────── */}
      <div className="space-y-5">

        {/* Category — grouped by parent */}
        <Field
          label="קטגוריה"
          id="category_id"
          required
          hint="בחרו את תת-הקטגוריה המתאימה (למשל: ירקות שורש, פירות הדר)"
          error={errors.category_id?.message}
        >
          <select
            id="category_id"
            {...register("category_id")}
            className={errors.category_id ? errInputCls : inputCls}
          >
            <option value="">בחרו קטגוריה...</option>
            {grouped.map((item, idx) =>
              item.type === "group" ? (
                <optgroup key={idx} label={item.parentName}>
                  {item.options.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </optgroup>
              ) : (
                <option key={item.cat.id} value={item.cat.id}>
                  {item.cat.name}
                </option>
              )
            )}
          </select>
        </Field>

        {/* Name */}
        <Field label="שם המוצר" id="name" required error={errors.name?.message}>
          <input
            id="name"
            type="text"
            placeholder="עגבניות שרי"
            {...register("name")}
            className={errors.name ? errInputCls : inputCls}
          />
        </Field>

        {/* Slug */}
        <Field
          label="Slug (מזהה ב-URL)"
          id="slug"
          required
          hint="מוצג ב-URL: /product/slug — אותיות לועזיות קטנות, ספרות ומקפים בלבד"
          error={errors.slug?.message}
        >
          <input
            id="slug"
            type="text"
            dir="ltr"
            placeholder="cherry-tomatoes"
            {...register("slug", { onChange: () => setSlugManuallyEdited(true) })}
            className={errors.slug ? errInputCls : inputCls}
          />
        </Field>

        {/* Description */}
        <Field label="תיאור" id="description" error={errors.description?.message}>
          <textarea
            id="description"
            rows={3}
            placeholder="תיאור קצר של המוצר..."
            {...register("description")}
            className={[
              "w-full bg-white border rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400",
              "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow resize-none",
              errors.description ? "border-red-400" : "border-gray-200",
            ].join(" ")}
          />
        </Field>

        {/* Image — file upload to Supabase Storage */}
        <div>
          <p className="block text-sm font-medium text-gray-700 mb-1.5">
            תמונת מוצר
            <span className="text-gray-400 font-normal ms-1 text-xs">(לא חובה)</span>
          </p>
          <ProductImageUpload
            currentUrl={imageUrlValue}
            onUpload={(url) => setValue("image_url", url, { shouldValidate: true })}
            onClear={() => setValue("image_url", "", { shouldValidate: false })}
            onUploadingChange={setIsImageUploading}
            error={errors.image_url?.message}
          />
        </div>

        {/* Sort order + flags */}
        <div className="grid grid-cols-3 gap-4">
          <Field label="סדר מיון" id="sort_order" required error={errors.sort_order?.message}>
            <input
              id="sort_order"
              type="number"
              min={0}
              dir="ltr"
              {...register("sort_order", { valueAsNumber: true })}
              className={errors.sort_order ? errInputCls : inputCls}
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
                פעיל
              </label>
            </div>
          </Field>

          <Field label="מומלץ" id="is_featured">
            <div className="flex items-center gap-3 h-10">
              <input
                id="is_featured"
                type="checkbox"
                {...register("is_featured")}
                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
              />
              <label htmlFor="is_featured" className="text-sm text-gray-700 cursor-pointer select-none">
                מומלץ
              </label>
            </div>
          </Field>
        </div>
      </div>

      {/* ── Divider ───────────────────────────────────────────────────────── */}
      <div className="border-t border-gray-100" />

      {/* ── Variants ──────────────────────────────────────────────────────── */}
      <VariantFields
        control={control}
        register={register}
        setValue={setValue}
        watch={watch}
        errors={errors}
      />

      {/* ── Server error ──────────────────────────────────────────────────── */}
      {serverError && (
        <div className="flex items-start gap-2.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          {serverError}
        </div>
      )}

      {/* ── Submit ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={isPending || isImageUploading}
          className="inline-flex items-center justify-center gap-2 h-10 px-6 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60 transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          )}
          {isImageUploading ? "ממתין לסיום העלאה..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
