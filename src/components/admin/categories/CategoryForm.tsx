"use client";

import { useEffect, useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { categorySchema, type CategoryFormData } from "@/lib/validations/admin-category";
import { slugify } from "@/lib/utils/slugify";
import { useSuccessFlash } from "@/hooks/useSuccessFlash";
import type { ActionResult } from "@/app/meshek22-control/(protected)/categories/actions";

interface ParentOption {
  id:   string;
  name: string;
  slug: string;
}

interface CategoryFormProps {
  /** Pre-filled values for edit mode. Omit for create mode. */
  defaultValues?: Partial<CategoryFormData>;
  /** The server action to call on submit. */
  action: (formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  /** Top-level categories available as parent options. */
  parentCategories: ParentOption[];
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

export function CategoryForm({
  defaultValues,
  action,
  submitLabel,
  parentCategories,
}: CategoryFormProps) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState("");
  const { visible: saved, trigger: showSaved, reset: resetSaved } = useSuccessFlash();
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(
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
      is_featured: defaultValues?.is_featured ?? false,
      show_in_navbar: defaultValues?.show_in_navbar ?? false,
      show_as_top_level_nav: defaultValues?.show_as_top_level_nav ?? false,
      parent_id:   defaultValues?.parent_id   ?? "",
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
    resetSaved();
    const fd = new FormData();
    fd.set("name",        data.name);
    fd.set("slug",        data.slug);
    fd.set("description", data.description ?? "");
    fd.set("image_url",   data.image_url ?? "");
    fd.set("sort_order",  String(data.sort_order));
    fd.set("is_active",   String(data.is_active));
    fd.set("is_featured", String(data.is_featured));
    fd.set("show_in_navbar", String(data.show_in_navbar));
    fd.set("show_as_top_level_nav", String(data.show_as_top_level_nav));
    fd.set("parent_id",   data.parent_id ?? "");

    startTransition(async () => {
      try {
        const result = await action(fd);
        if (result && !result.success) {
          setServerError(result.error);
        } else {
          // A create still ends with redirect() on the server (caught below);
          // an update now resolves normally with {success:true} instead — see
          // completeUpdateMutation in src/lib/admin/instrumentation.ts — so
          // this is the edit path staying on the form with a saved indicator.
          showSaved();
        }
      } catch (err) {
        // A successful CREATE ends with redirect() on the server, which
        // crosses this Server Action call as a thrown "NEXT_REDIRECT"
        // signal, not a return value — awaiting the action directly (rather
        // than via a native <form action>) means that signal lands right
        // here. unstable_rethrow lets it continue propagating so the
        // framework still performs the navigation; anything else is a real
        // failure and falls through to the message below.
        unstable_rethrow(err);
        console.error("[CategoryForm] submit failed", err);
        setServerError("אירעה שגיאה בלתי צפויה. נסו שוב.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {/* Parent category */}
      <Field
        label="קטגוריה ראשית (אב)"
        id="parent_id"
        hint="השאירו ריק כדי ליצור קטגוריה ראשית. בחרו קטגוריה אב כדי ליצור תת-קטגוריה. ה-slug מוצג בסוגריים כי ייתכנו שתי קטגוריות בשם זהה (למשל שתי קטגוריות 'ירקות') — ודאו שאתם בוחרים ב-slug הנכון."
        error={errors.parent_id?.message}
      >
        <select
          id="parent_id"
          {...register("parent_id")}
          className={errors.parent_id ? errorInputClass : inputClass}
        >
          <option value="">— קטגוריה ראשית (ללא אב) —</option>
          {parentCategories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name} ({cat.slug})
            </option>
          ))}
        </select>
      </Field>

      {/* Name */}
      <Field label="שם הקטגוריה" id="name" required error={errors.name?.message}>
        <input
          id="name"
          type="text"
          placeholder="ירקות שורש"
          {...register("name")}
          className={errors.name ? errorInputClass : inputClass}
        />
      </Field>

      {/* Slug */}
      <Field
        label="Slug (מזהה ב-URL)"
        id="slug"
        required
        hint="מוצג ב-URL — ניתן לשנות, אותיות לועזיות, ספרות ומקפים בלבד"
        error={errors.slug?.message}
      >
        <input
          id="slug"
          type="text"
          dir="ltr"
          placeholder="root-vegetables"
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

      {/* Sort order + Is active + Is featured */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

        <Field
          label="מובילת"
          id="is_featured"
          hint="הצג בדף הבית"
        >
          <div className="flex items-center gap-3 h-10">
            <input
              id="is_featured"
              type="checkbox"
              {...register("is_featured")}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
            />
            <label htmlFor="is_featured" className="text-sm text-gray-700 cursor-pointer select-none">
              מובילת
            </label>
          </div>
        </Field>

      </div>

      {/* Navbar visibility — two independent controls: submenu placement
          (show_in_navbar) and top-level promotion (show_as_top_level_nav).
          Grouped together since both govern navbar display, but neither
          setting affects the other. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="בתפריט העליון"
          id="show_in_navbar"
          hint="נפרד מ'פעילה' — קטגוריה פעילה נשארת זמינה גם אם זה כבוי"
        >
          <div className="flex items-center gap-3 h-10">
            <input
              id="show_in_navbar"
              type="checkbox"
              {...register("show_in_navbar")}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
            />
            <label htmlFor="show_in_navbar" className="text-sm text-gray-700 cursor-pointer select-none">
              הצג בתפריט העליון
            </label>
          </div>
        </Field>

        <Field
          label="כותרת ראשית בתפריט"
          id="show_as_top_level_nav"
          hint="הקטגוריה תישאר תחת קטגוריית האב ותופיע בנוסף כקישור ראשי בתפריט."
        >
          <div className="flex items-center gap-3 h-10">
            <input
              id="show_as_top_level_nav"
              type="checkbox"
              {...register("show_as_top_level_nav")}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
            />
            <label htmlFor="show_as_top_level_nav" className="text-sm text-gray-700 cursor-pointer select-none">
              הצג גם ככותרת ראשית בתפריט העליון
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

      {/* Saved confirmation — only reachable on the update path, which no
          longer redirects (see completeUpdateMutation). */}
      {saved && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2.5 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          עודכן בהצלחה
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
          {isPending ? "שומר..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
