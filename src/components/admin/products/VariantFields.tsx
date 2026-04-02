"use client";

import { useFieldArray, type Control, type UseFormRegister, type UseFormSetValue, type UseFormWatch, type FieldErrors } from "react-hook-form";
import { Plus, Trash2, Star } from "lucide-react";
import { VARIANT_UNITS, VARIANT_UNIT_LABELS, type ProductFormData, type VariantFormData } from "@/lib/validations/admin-product";

interface VariantFieldsProps {
  control:   Control<ProductFormData>;
  register:  UseFormRegister<ProductFormData>;
  setValue:  UseFormSetValue<ProductFormData>;
  watch:     UseFormWatch<ProductFormData>;
  errors:    FieldErrors<ProductFormData>;
}

const DEFAULT_VARIANT: VariantFormData = {
  unit:          "unit",
  label:         "יחידה",
  price:         0,
  compare_price: null,
  stock_quantity: null,
  is_available:  true,
  is_default:    false,
  sort_order:    0,
};

const inputCls =
  "w-full h-9 bg-white border border-gray-200 rounded-lg px-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow";
const errInputCls =
  "w-full h-9 bg-white border border-red-400 rounded-lg px-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent transition-shadow";

export function VariantFields({ control, register, setValue, watch, errors }: VariantFieldsProps) {
  const { fields, append, remove } = useFieldArray({ control, name: "variants" });

  const variants = watch("variants");

  const handleSetDefault = (index: number) => {
    fields.forEach((_, i) => {
      setValue(`variants.${i}.is_default`, i === index, { shouldDirty: true });
    });
  };

  const handleAddVariant = () => {
    append({ ...DEFAULT_VARIANT, sort_order: fields.length });
  };

  // Top-level variants array error (e.g. "at least one", "exactly one default")
  const arrayError = errors.variants?.root?.message ?? (errors.variants as { message?: string } | undefined)?.message;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">גרסאות</h3>
          <p className="text-xs text-gray-400 mt-0.5">מחיר ב-אגורות חלקי 100 = ₪</p>
        </div>
        <button
          type="button"
          onClick={handleAddVariant}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-brand-600 hover:bg-brand-50 border border-brand-200 transition-colors cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          הוסף גרסה
        </button>
      </div>

      {arrayError && (
        <p className="text-xs text-red-500">{arrayError}</p>
      )}

      {fields.map((field, i) => {
        const vErr = errors.variants?.[i];
        const isDefault = variants?.[i]?.is_default ?? false;
        const isAvailable = variants?.[i]?.is_available ?? true;

        return (
          <div
            key={field.id}
            className={[
              "rounded-xl border p-4 space-y-3 transition-colors",
              isDefault ? "border-brand-300 bg-brand-50/30" : "border-gray-200 bg-white",
            ].join(" ")}
          >
            {/* Card header */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-gray-500 w-14 shrink-0">
                גרסה {i + 1}
              </span>

              {/* Default toggle */}
              <button
                type="button"
                onClick={() => handleSetDefault(i)}
                className={[
                  "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer",
                  isDefault
                    ? "bg-brand-600 text-white border-brand-600"
                    : "text-gray-500 border-gray-200 hover:border-brand-300 hover:text-brand-600",
                ].join(" ")}
                title="הגדר כברירת מחדל"
              >
                <Star className="h-3 w-3" aria-hidden="true" />
                {isDefault ? "ברירת מחדל" : "הגדר כברירת מחדל"}
              </button>

              {/* Available toggle */}
              <label className="inline-flex items-center gap-1.5 cursor-pointer ms-1">
                <input
                  type="checkbox"
                  {...register(`variants.${i}.is_available`)}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                />
                <span className={["text-xs font-medium", isAvailable ? "text-gray-700" : "text-gray-400 line-through"].join(" ")}>
                  זמין
                </span>
              </label>

              {/* Remove */}
              <button
                type="button"
                onClick={() => remove(i)}
                disabled={fields.length === 1}
                className="ms-auto inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 border border-transparent hover:border-red-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="הסר גרסה"
              >
                <Trash2 className="h-3 w-3" aria-hidden="true" />
                הסר
              </button>
            </div>

            {/* Row 1: unit + label */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  יחידה <span className="text-red-500">*</span>
                </label>
                <select
                  {...register(`variants.${i}.unit`)}
                  className={vErr?.unit ? errInputCls : inputCls}
                >
                  {VARIANT_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {VARIANT_UNIT_LABELS[u]}
                    </option>
                  ))}
                </select>
                {vErr?.unit && <p className="mt-0.5 text-xs text-red-500">{vErr.unit.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  תווית <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder='1 ק"ג'
                  {...register(`variants.${i}.label`)}
                  className={vErr?.label ? errInputCls : inputCls}
                />
                {vErr?.label && <p className="mt-0.5 text-xs text-red-500">{vErr.label.message}</p>}
              </div>
            </div>

            {/* Row 2: price + compare_price + stock + sort_order */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  מחיר (₪) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  dir="ltr"
                  placeholder="9.90"
                  {...register(`variants.${i}.price`, { valueAsNumber: true })}
                  className={vErr?.price ? errInputCls : inputCls}
                />
                {vErr?.price && <p className="mt-0.5 text-xs text-red-500">{vErr.price.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">מחיר מקורי (₪)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  dir="ltr"
                  placeholder="—"
                  {...register(`variants.${i}.compare_price`, {
                    setValueAs: (v) => (v === "" || v === null || v === undefined) ? null : parseFloat(v),
                  })}
                  className={vErr?.compare_price ? errInputCls : inputCls}
                />
                {vErr?.compare_price && (
                  <p className="mt-0.5 text-xs text-red-500">{vErr.compare_price.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">מלאי</label>
                <input
                  type="number"
                  min="0"
                  dir="ltr"
                  placeholder="∞"
                  {...register(`variants.${i}.stock_quantity`, {
                    setValueAs: (v) => (v === "" || v === null || v === undefined) ? null : parseInt(v, 10),
                  })}
                  className={vErr?.stock_quantity ? errInputCls : inputCls}
                />
                {vErr?.stock_quantity && (
                  <p className="mt-0.5 text-xs text-red-500">{vErr.stock_quantity.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">סדר מיון</label>
                <input
                  type="number"
                  min="0"
                  dir="ltr"
                  {...register(`variants.${i}.sort_order`, { valueAsNumber: true })}
                  className={vErr?.sort_order ? errInputCls : inputCls}
                />
                {vErr?.sort_order && (
                  <p className="mt-0.5 text-xs text-red-500">{vErr.sort_order.message}</p>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {fields.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center">
          <p className="text-sm text-gray-400">אין גרסאות. הוסיפו לפחות גרסה אחת.</p>
        </div>
      )}
    </div>
  );
}
