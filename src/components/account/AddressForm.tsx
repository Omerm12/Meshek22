"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MapPin, Info, Loader2 } from "lucide-react";
import { saveAddress } from "@/app/(account)/actions";
import { searchSettlements } from "@/lib/data/settlements";
import { DELIVERY_ZONES, findZoneByCity } from "@/lib/delivery";
import { formatPrice } from "@/lib/utils/money";
import type { Database } from "@/types/database";

type AddressRow = Database["public"]["Tables"]["addresses"]["Row"];

interface AddressFormProps {
  address?: AddressRow; // undefined = new address
}

export function AddressForm({ address }: AddressFormProps) {
  const [city, setCity] = useState(address?.city ?? "");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [zoneInfo, setZoneInfo] = useState(() =>
    address?.city ? findZoneByCity(address.city) : undefined
  );
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Parse back floor/apartment from combined string
  const existingApartment = address?.apartment ?? "";
  const apartmentMatch = existingApartment.match(/דירה\s+(\S+)/);
  const floorMatch = existingApartment.match(/קומה\s+(\S+)/);
  const defaultApartment = apartmentMatch?.[1] ?? "";
  const defaultFloor = floorMatch?.[1] ?? "";

  useEffect(() => {
    if (city.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const results = searchSettlements(city);
    setSuggestions(results.map((s) => s.name));
  }, [city]);

  const selectCity = useCallback((name: string) => {
    setCity(name);
    setShowSuggestions(false);
    setZoneInfo(findZoneByCity(name));
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setError("");

    const formData = new FormData(e.currentTarget);

    try {
      const result = await saveAddress(formData);
      if (result?.error) {
        setError(result.error);
        setPending(false);
      }
      // On success, saveAddress redirects — no further action needed
    } catch {
      // redirect() throws internally; this is expected on success
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {address && <input type="hidden" name="id" value={address.id} />}

      {/* Label */}
      <div>
        <label htmlFor="label" className="block text-sm font-medium text-gray-700 mb-1.5">
          תווית{" "}
          <span className="text-stone-400 font-normal">(לדוגמה: בית, עבודה)</span>
        </label>
        <input
          id="label"
          name="label"
          type="text"
          defaultValue={address?.label ?? ""}
          placeholder="בית"
          className="w-full h-11 bg-white border border-stone-200 rounded-xl px-4 text-sm text-gray-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
        />
      </div>

      {/* City / Settlement combobox */}
      <div className="relative">
        <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1.5">
          עיר / יישוב <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <MapPin
            className="absolute top-1/2 -translate-y-1/2 start-3.5 h-4 w-4 text-stone-400 pointer-events-none"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            id="city"
            name="city"
            type="text"
            required
            autoComplete="off"
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setShowSuggestions(true);
              if (!e.target.value) setZoneInfo(undefined);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="הקלידו שם עיר..."
            className="w-full h-11 bg-white border border-stone-200 rounded-xl ps-10 pe-4 text-sm text-gray-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
          />
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <ul
            className="absolute z-20 w-full mt-1 bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden"
            role="listbox"
          >
            {suggestions.map((name) => (
              <li
                key={name}
                role="option"
                aria-selected={city === name}
                onMouseDown={(e) => {
                  e.preventDefault(); // prevent blur before click
                  selectCity(name);
                }}
                className="px-4 py-2.5 text-sm text-gray-800 hover:bg-brand-50 hover:text-brand-700 cursor-pointer transition-colors"
              >
                {name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Delivery zone info */}
      {zoneInfo && (
        <div className="flex items-start gap-2.5 bg-brand-50 border border-brand-100 rounded-xl px-4 py-3">
          <Info className="h-4 w-4 text-brand-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-xs text-brand-800 leading-relaxed">
            <strong className="font-semibold">{zoneInfo.name}</strong> ·{" "}
            {zoneInfo.baseFeeAgorot === 0
              ? "משלוח חינם!"
              : `דמי משלוח ${formatPrice(zoneInfo.baseFeeAgorot)}`}
            {zoneInfo.freeThrsholdAgorot && (
              <> · חינם מ-{formatPrice(zoneInfo.freeThrsholdAgorot)}</>
            )}
            {" "}· הגעה: {zoneInfo.estimatedDays}
            <br />
            <span className="text-brand-700">
              הזמנה מינימלית {formatPrice(zoneInfo.minOrderAgorot)}
            </span>
          </div>
        </div>
      )}

      {/* Hidden zone slug field */}
      <input
        type="hidden"
        name="delivery_zone_id"
        value={zoneInfo?.slug ?? ""}
      />

      {/* Street + House number */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label htmlFor="street" className="block text-sm font-medium text-gray-700 mb-1.5">
            רחוב <span className="text-red-500">*</span>
          </label>
          <input
            id="street"
            name="street"
            type="text"
            required
            defaultValue={address?.street ?? ""}
            placeholder="שם הרחוב"
            className="w-full h-11 bg-white border border-stone-200 rounded-xl px-4 text-sm text-gray-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
          />
        </div>
        <div>
          <label htmlFor="house_number" className="block text-sm font-medium text-gray-700 mb-1.5">
            מספר <span className="text-red-500">*</span>
          </label>
          <input
            id="house_number"
            name="house_number"
            type="text"
            required
            defaultValue={address?.house_number ?? ""}
            placeholder="12"
            className="w-full h-11 bg-white border border-stone-200 rounded-xl px-4 text-sm text-gray-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
          />
        </div>
      </div>

      {/* Floor + Apartment */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="floor" className="block text-sm font-medium text-gray-700 mb-1.5">
            קומה
          </label>
          <input
            id="floor"
            name="floor"
            type="text"
            defaultValue={defaultFloor}
            placeholder="3"
            className="w-full h-11 bg-white border border-stone-200 rounded-xl px-4 text-sm text-gray-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
          />
        </div>
        <div>
          <label htmlFor="apartment" className="block text-sm font-medium text-gray-700 mb-1.5">
            דירה
          </label>
          <input
            id="apartment"
            name="apartment"
            type="text"
            defaultValue={defaultApartment}
            placeholder="5א"
            className="w-full h-11 bg-white border border-stone-200 rounded-xl px-4 text-sm text-gray-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
          />
        </div>
      </div>

      {/* ZIP code */}
      <div>
        <label htmlFor="zip_code" className="block text-sm font-medium text-gray-700 mb-1.5">
          מיקוד{" "}
          <span className="text-stone-400 font-normal">(לא חובה)</span>
        </label>
        <input
          id="zip_code"
          name="zip_code"
          type="text"
          dir="ltr"
          inputMode="numeric"
          defaultValue={address?.zip_code ?? ""}
          placeholder="1234567"
          className="w-full h-11 bg-white border border-stone-200 rounded-xl px-4 text-sm text-gray-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
        />
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1.5">
          הוראות לשליח{" "}
          <span className="text-stone-400 font-normal">(לא חובה)</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          defaultValue={address?.notes ?? ""}
          placeholder="לדוגמה: להשאיר ליד הדלת, לצלצל פעמיים"
          className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow resize-none"
        />
      </div>

      {/* Default checkbox */}
      <label className="flex items-center gap-3 cursor-pointer select-none group">
        <input
          type="checkbox"
          name="is_default"
          value="true"
          defaultChecked={address?.is_default ?? false}
          className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500 accent-brand-600 cursor-pointer"
        />
        <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
          הגדרו כברירת מחדל
        </span>
      </label>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full h-11 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : address ? (
          "שמרו שינויים"
        ) : (
          "הוסיפו כתובת"
        )}
      </button>
    </form>
  );
}
