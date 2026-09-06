"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { formatPrice } from "@/lib/utils/money";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import {
  searchPromotionVariants,
  type ActionResult,
  type PromotionVariantOption,
} from "@/app/meshek22-control/(protected)/promotions/actions";

export interface PromotionFormValues {
  name: string;
  description: string;
  requiredQuantity: number;
  bundlePriceShekels: number;
  isActive: boolean;
  /** "YYYY-MM-DDTHH:mm" for <input type="datetime-local">, or "". */
  startsAt: string;
  endsAt: string;
  sortOrder: number;
  selectedVariants: PromotionVariantOption[];
}

interface PromotionFormProps {
  initialValues: PromotionFormValues;
  action: (formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
}

const inputClass =
  "w-full h-11 px-3.5 rounded-xl border border-gray-300 bg-white text-gray-900 text-base sm:text-sm " +
  "placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow";

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">{hint}</p>}
    </div>
  );
}

export function PromotionForm({ initialValues, action, submitLabel }: PromotionFormProps) {
  const [name, setName] = useState(initialValues.name);
  const [description, setDescription] = useState(initialValues.description);
  const [requiredQuantity, setRequiredQuantity] = useState(String(initialValues.requiredQuantity));
  const [bundlePrice, setBundlePrice] = useState(String(initialValues.bundlePriceShekels));
  const [isActive, setIsActive] = useState(initialValues.isActive);
  const [startsAt, setStartsAt] = useState(initialValues.startsAt);
  const [endsAt, setEndsAt] = useState(initialValues.endsAt);
  const [sortOrder, setSortOrder] = useState(String(initialValues.sortOrder));

  const [selected, setSelected] = useState<PromotionVariantOption[]>(initialValues.selectedVariants);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PromotionVariantOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const errorRef = useRef<HTMLDivElement>(null);

  // ── Debounced product search ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setIsSearching(true);
    const id = setTimeout(async () => {
      try {
        const found = await searchPromotionVariants(query);
        if (!cancelled) setResults(found);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query]);

  // Move focus to the error so it is announced and visible on mobile.
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const selectedIds = useMemo(() => new Set(selected.map((v) => v.variantId)), [selected]);

  /** Group the picked variants under their product, which is how owners think. */
  const groupedSelection = useMemo(() => {
    const byProduct = new Map<string, { productName: string; variants: PromotionVariantOption[] }>();
    for (const variant of selected) {
      const entry = byProduct.get(variant.productId) ?? {
        productName: variant.productName,
        variants: [],
      };
      entry.variants.push(variant);
      byProduct.set(variant.productId, entry);
    }
    return [...byProduct.entries()].map(([productId, value]) => ({ productId, ...value }));
  }, [selected]);

  const addVariant = (variant: PromotionVariantOption) => {
    if (variant.isPerKg) {
      setError(
        `"${variant.productName}" נמכר לפי משקל ולכן לא ניתן לכלול אותו במבצע כמות. בחרו וריאציה הנמכרת ביחידות.`
      );
      return;
    }
    setError(null);
    setSelected((prev) =>
      prev.some((v) => v.variantId === variant.variantId) ? prev : [...prev, variant]
    );
  };

  const removeVariant = (variantId: string) =>
    setSelected((prev) => prev.filter((v) => v.variantId !== variantId));

  const removeProduct = (productId: string) =>
    setSelected((prev) => prev.filter((v) => v.productId !== productId));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side checks mirror the server schema so the owner gets immediate
    // feedback; the server validates again regardless.
    const qty = Number(requiredQuantity);
    if (!Number.isInteger(qty) || qty < 2) {
      setError("הכמות הנדרשת חייבת להיות מספר שלם, לפחות 2");
      return;
    }
    const price = Number(bundlePrice);
    if (!Number.isFinite(price) || price < 0) {
      setError("נא להזין מחיר תקין למבצע");
      return;
    }
    if (selected.length === 0) {
      setError("נא לבחור לפחות מוצר אחד למבצע");
      return;
    }

    const fd = new FormData();
    fd.set("name", name);
    fd.set("description", description);
    fd.set("required_quantity", String(qty));
    fd.set("bundle_price_shekels", String(price));
    fd.set("is_active", String(isActive));
    fd.set("starts_at", startsAt);
    fd.set("ends_at", endsAt);
    fd.set("sort_order", sortOrder || "0");
    fd.set("variant_ids", JSON.stringify(selected.map((v) => v.variantId)));

    startTransition(async () => {
      try {
        const result = await action(fd);
        // A successful create/update redirects, so reaching here means failure.
        if (result && !result.success) setError(result.error);
      } catch (err) {
        console.error("[PromotionForm] submit failed", err);
        setError("אירעה שגיאה בלתי צפויה. נסו שוב.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {error && (
        <div
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          aria-live="assertive"
          className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 p-3.5 text-sm text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Basics ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 space-y-4">
        <h2 className="font-bold text-gray-900">פרטי המבצע</h2>

        <Field label="שם המבצע" htmlFor="promo-name" hint="השם מוצג ללקוח בסל ובקופה, לדוגמה: 4 ב־10 ₪">
          <input
            id="promo-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="4 ב־10 ₪"
            required
          />
        </Field>

        <Field label="תיאור (לא חובה)" htmlFor="promo-description">
          <input
            id="promo-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
            placeholder="לדוגמה: כל ארבע גלידות מגנום"
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="כמות נדרשת" htmlFor="promo-qty" hint="מספר הפריטים בקבוצה">
            <input
              id="promo-qty"
              type="number"
              inputMode="numeric"
              min={2}
              max={100}
              step={1}
              value={requiredQuantity}
              onChange={(e) => setRequiredQuantity(e.target.value)}
              className={inputClass}
              required
            />
          </Field>

          <Field label="מחיר לקבוצה (₪)" htmlFor="promo-price" hint="המחיר הכולל עבור כל הקבוצה">
            <input
              id="promo-price"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={bundlePrice}
              onChange={(e) => setBundlePrice(e.target.value)}
              className={inputClass}
              required
            />
          </Field>

          <Field label="סדר תצוגה" htmlFor="promo-sort" hint="מספר נמוך = עדיפות גבוהה">
            <input
              id="promo-sort"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="תאריך התחלה (לא חובה)" htmlFor="promo-start">
            <input
              id="promo-start"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="תאריך סיום (לא חובה)" htmlFor="promo-end" hint="לאחר מועד זה המבצע יפסיק לחול אוטומטית">
            <input
              id="promo-end"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 accent-brand-600"
          />
          <span className="text-sm font-medium text-gray-700">המבצע פעיל</span>
        </label>
      </div>

      {/* ── Product selection ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className="font-bold text-gray-900">מוצרים במבצע</h2>
          <span className="text-sm font-semibold text-brand-700 bg-brand-50 border border-brand-100 rounded-full px-3 py-1">
            {selected.length} וריאציות · {groupedSelection.length} מוצרים
          </span>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search
            className="absolute top-1/2 -translate-y-1/2 start-3.5 h-4 w-4 text-gray-400 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש מוצר להוספה..."
            aria-label="חיפוש מוצר להוספה למבצע"
            className={`${inputClass} ps-10`}
          />
          {isSearching && (
            <Loader2
              className="absolute top-1/2 -translate-y-1/2 end-3.5 h-4 w-4 text-gray-400 animate-spin"
              aria-hidden="true"
            />
          )}
        </div>

        {/* Search results */}
        <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100 mb-5">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">
              {isSearching ? "מחפש..." : "לא נמצאו מוצרים"}
            </p>
          ) : (
            results.map((variant) => {
              const already = selectedIds.has(variant.variantId);
              return (
                <div
                  key={variant.variantId}
                  className="flex items-center gap-3 px-4 py-2.5 min-h-[52px]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {variant.productName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {variant.variantLabel} · {formatPrice(variant.priceAgorot)}
                      {variant.isPerKg && (
                        <span className="text-amber-600 font-medium"> · נמכר לפי משקל</span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addVariant(variant)}
                    disabled={already || variant.isPerKg}
                    aria-label={`הוסף ${variant.productName} ${variant.variantLabel} למבצע`}
                    title={
                      variant.isPerKg
                        ? "מוצרים הנמכרים לפי משקל אינם נתמכים במבצע כמות"
                        : already
                          ? "כבר נבחר"
                          : "הוספה למבצע"
                    }
                    className="shrink-0 h-9 w-9 flex items-center justify-center rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Selected, grouped by product */}
        <h3 className="text-sm font-semibold text-gray-700 mb-2">נבחרו למבצע</h3>
        {groupedSelection.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">עדיין לא נבחרו מוצרים.</p>
        ) : (
          <ul className="space-y-2">
            {groupedSelection.map((group) => (
              <li key={group.productId} className="rounded-xl border border-gray-200 p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-sm font-semibold text-gray-900 truncate">{group.productName}</p>
                  <button
                    type="button"
                    onClick={() => removeProduct(group.productId)}
                    aria-label={`הסר את ${group.productName} מהמבצע`}
                    className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {group.variants.map((variant) => (
                    <span
                      key={variant.variantId}
                      className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 ps-2.5 pe-1 py-1 text-xs text-gray-700"
                    >
                      {variant.variantLabel} · {formatPrice(variant.priceAgorot)}
                      <button
                        type="button"
                        onClick={() => removeVariant(variant.variantId)}
                        aria-label={`הסר וריאציה ${variant.variantLabel} של ${group.productName}`}
                        className="h-5 w-5 flex items-center justify-center rounded-full text-gray-400 hover:text-red-600 hover:bg-red-100 transition-colors"
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3">
        <Link
          href={ADMIN_ROUTES.promotions}
          className="inline-flex items-center justify-center h-11 px-6 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
        >
          ביטול
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {isPending ? "שומר..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
