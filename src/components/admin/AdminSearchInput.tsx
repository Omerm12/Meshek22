"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";

interface AdminSearchInputProps {
  /** Initial value from server-rendered searchParam */
  defaultValue?: string;
  placeholder?: string;
  /** The URL param name to set (default: "q") */
  paramName?: string;
  /** Other query params to preserve in the URL (e.g. zone filter) */
  extraParams?: Record<string, string>;
  /** Debounce delay in ms (default: 300) */
  debounceMs?: number;
}

/**
 * Live search input for admin tables.
 * Updates the URL search param on each keystroke (debounced) and always
 * resets page to 1 when the query changes.
 * Does NOT use useSearchParams() so no <Suspense> wrapper is required.
 */
export function AdminSearchInput({
  defaultValue = "",
  placeholder = "חיפוש...",
  paramName = "q",
  extraParams = {},
  debounceMs = 300,
}: AdminSearchInputProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(defaultValue);
  const [isPending, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local value in sync if defaultValue changes (e.g. user presses browser back)
  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  const navigate = (newVal: string) => {
    const params = new URLSearchParams();
    if (newVal.trim()) params.set(paramName, newVal.trim());
    // Preserve extra params (e.g. zone), but always drop page so we start at 1
    for (const [k, v] of Object.entries(extraParams)) {
      if (v) params.set(k, v);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(`${pathname}${qs ? `?${qs}` : ""}`);
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setValue(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => navigate(val), debounceMs);
  };

  const handleClear = () => {
    setValue("");
    if (timerRef.current) clearTimeout(timerRef.current);
    navigate("");
  };

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <div className="relative flex-1 min-w-48">
      <div className="absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none flex items-center">
        {isPending ? (
          <Loader2 className="h-4 w-4 text-gray-400 animate-spin" aria-hidden="true" />
        ) : (
          <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />
        )}
      </div>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full h-10 bg-white border border-gray-200 rounded-xl ps-9 pe-8 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute top-1/2 -translate-y-1/2 end-2.5 p-0.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="נקה חיפוש"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
