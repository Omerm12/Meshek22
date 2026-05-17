"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";
import Link from "next/link";

interface Zone {
  id: string;
  name: string;
}

interface SettlementsFiltersClientProps {
  initialQ: string;
  initialZone: string;
  zones: Zone[];
}

/**
 * Live filter bar for the settlements admin page.
 * Text search is debounced; zone select navigates immediately on change.
 * Both filters navigate to page 1 on change.
 */
export function SettlementsFiltersClient({
  initialQ,
  initialZone,
  zones,
}: SettlementsFiltersClientProps) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [zone, setZone] = useState(initialZone);
  const [isPending, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setQ(initialQ); }, [initialQ]);
  useEffect(() => { setZone(initialZone); }, [initialZone]);

  const buildUrl = (newQ: string, newZone: string) => {
    const params = new URLSearchParams();
    if (newQ.trim()) params.set("q", newQ.trim());
    if (newZone) params.set("zone", newZone);
    const qs = params.toString();
    return `/admin/settlements${qs ? `?${qs}` : ""}`;
  };

  const navigate = (newQ: string, newZone: string) => {
    startTransition(() => {
      router.push(buildUrl(newQ, newZone));
    });
  };

  const handleQChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQ(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => navigate(val, zone), 300);
  };

  const handleQClear = () => {
    setQ("");
    if (timerRef.current) clearTimeout(timerRef.current);
    navigate("", zone);
  };

  const handleZoneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setZone(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    navigate(q, val);
  };

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const hasFilters = !!(q.trim() || zone);

  return (
    <div className="flex flex-wrap gap-3 mb-5">
      {/* Text search */}
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
          value={q}
          onChange={handleQChange}
          placeholder="חיפוש לפי שם יישוב..."
          className="w-full h-10 bg-white border border-gray-200 rounded-xl ps-9 pe-8 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
        />
        {q && (
          <button
            type="button"
            onClick={handleQClear}
            className="absolute top-1/2 -translate-y-1/2 end-2.5 p-0.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="נקה חיפוש"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Zone select */}
      <select
        value={zone}
        onChange={handleZoneChange}
        className="h-10 bg-white border border-gray-200 rounded-xl px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
      >
        <option value="">כל אזורי המשלוח</option>
        <option value="unassigned">ללא אזור משלוח</option>
        {zones.map((z) => (
          <option key={z.id} value={z.id}>{z.name}</option>
        ))}
      </select>

      {/* Clear all filters */}
      {hasFilters && (
        <Link
          href="/admin/settlements"
          className="h-10 px-4 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50 transition-colors inline-flex items-center gap-1.5"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          נקה סינון
        </Link>
      )}
    </div>
  );
}
