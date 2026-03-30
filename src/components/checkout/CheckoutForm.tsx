"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin,
  User,
  Phone,
  Mail,
  MessageSquare,
  Truck,
  AlertCircle,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { useCart } from "@/store/cart";
import { formatPrice } from "@/lib/utils/money";
import { getDeliveryQuote, findZoneByCity } from "@/lib/delivery";
import { searchSettlements } from "@/lib/data/settlements";
import type { Settlement } from "@/lib/data/settlements";
import { createOrder } from "@/app/(shop)/checkout/actions";
import type { Database } from "@/types/database";

type AddressRow = Database["public"]["Tables"]["addresses"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

interface CheckoutFormProps {
  addresses: AddressRow[];
  profile: ProfileRow | null;
  userEmail: string | null;
}

function InputField({
  label,
  id,
  required,
  children,
}: {
  label: string;
  id: string;
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
    </div>
  );
}

const inputClass =
  "w-full h-11 px-3.5 rounded-xl border border-stone-200 bg-white text-gray-900 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow";

export function CheckoutForm({ addresses, profile, userEmail }: CheckoutFormProps) {
  const router = useRouter();
  const { items, subtotalAgorot, clearCart } = useCart();

  // ── Address state ──────────────────────────────────────────────────────────
  const defaultAddress = addresses.find((a) => a.is_default) ?? addresses[0] ?? null;
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    defaultAddress?.id ?? null
  );
  const [useNewAddress, setUseNewAddress] = useState(addresses.length === 0);

  // Manual address fields
  const [manualCity, setManualCity] = useState("");
  const [manualStreet, setManualStreet] = useState("");
  const [manualHouseNumber, setManualHouseNumber] = useState("");
  const [manualApartment, setManualApartment] = useState("");

  // Settlement combobox
  const [settlementResults, setSettlementResults] = useState<Settlement[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const comboboxRef = useRef<HTMLDivElement>(null);

  // ── Delivery zone ──────────────────────────────────────────────────────────
  const [deliveryZoneSlug, setDeliveryZoneSlug] = useState<string | null>(() => {
    if (defaultAddress?.delivery_zone_id) return defaultAddress.delivery_zone_id;
    if (defaultAddress?.city) return findZoneByCity(defaultAddress.city)?.slug ?? null;
    return null;
  });

  // Customer details
  const [name, setName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [email, setEmail] = useState(userEmail ?? "");
  const [notes, setNotes] = useState("");

  // Submission
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  // ── Redirect if cart empty ─────────────────────────────────────────────────
  useEffect(() => {
    if (items.length === 0) {
      router.replace("/cart");
    }
  }, [items.length, router]);

  // ── Update zone when selected address changes ──────────────────────────────
  useEffect(() => {
    if (useNewAddress) return;
    if (!selectedAddressId) {
      setDeliveryZoneSlug(null);
      return;
    }
    const addr = addresses.find((a) => a.id === selectedAddressId);
    if (!addr) return;
    if (addr.delivery_zone_id) {
      setDeliveryZoneSlug(addr.delivery_zone_id);
    } else {
      setDeliveryZoneSlug(findZoneByCity(addr.city)?.slug ?? null);
    }
  }, [selectedAddressId, useNewAddress, addresses]);

  // ── Update zone when manual city changes ──────────────────────────────────
  useEffect(() => {
    if (!useNewAddress) return;
    const zone = findZoneByCity(manualCity);
    setDeliveryZoneSlug(zone?.slug ?? null);
  }, [manualCity, useNewAddress]);

  // ── Settlement search ──────────────────────────────────────────────────────
  useEffect(() => {
    if (manualCity.length >= 2) {
      setSettlementResults(searchSettlements(manualCity));
    } else {
      setSettlementResults([]);
    }
  }, [manualCity]);

  // Close combobox on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Delivery quote ─────────────────────────────────────────────────────────
  const quote = useMemo(() => {
    if (!deliveryZoneSlug) return null;
    return getDeliveryQuote(deliveryZoneSlug, subtotalAgorot);
  }, [deliveryZoneSlug, subtotalAgorot]);

  const totalAgorot = subtotalAgorot + (quote?.feeAgorot ?? 0);

  // ── Get address to use in submission ──────────────────────────────────────
  const getAddressFields = () => {
    if (!useNewAddress && selectedAddressId) {
      const addr = addresses.find((a) => a.id === selectedAddressId)!;
      return {
        street: addr.street,
        house_number: addr.house_number,
        city: addr.city,
        apartment: addr.apartment ?? "",
      };
    }
    return {
      street: manualStreet,
      house_number: manualHouseNumber,
      city: manualCity,
      apartment: manualApartment,
    };
  };

  // ── Form submission ────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!deliveryZoneSlug) {
      setError("לא ניתן לזהות את אזור המשלוח. נא לבחור עיר מהרשימה.");
      return;
    }

    if (!quote?.meetsMinimum) {
      setError(
        `ההזמנה המינימלית לאזור ${quote?.zone.name ?? ""} לא הושגה.`
      );
      return;
    }

    setIsPending(true);

    const addrFields = getAddressFields();
    const fd = new FormData();

    fd.set(
      "cart_items",
      JSON.stringify(
        items.map((i) => ({
          variantId: i.variantId,
          quantity: i.quantity,
          productName: i.productName,
          variantLabel: i.variantLabel,
        }))
      )
    );
    fd.set("delivery_zone_id", deliveryZoneSlug);
    fd.set("customer_name", name);
    fd.set("customer_phone", phone);
    fd.set("customer_email", email);
    fd.set("delivery_notes", notes);
    fd.set("address_street", addrFields.street);
    fd.set("address_house_number", addrFields.house_number);
    fd.set("address_city", addrFields.city);
    fd.set("address_apartment", addrFields.apartment);

    try {
      const result = await createOrder(fd);
      if ("error" in result) {
        setError(result.error);
        setIsPending(false);
      } else {
        clearCart();
        window.location.href = result.paymentUrl;
      }
    } catch {
      setError("שגיאה לא צפויה. נא לנסות שוב.");
      setIsPending(false);
    }
  };

  if (items.length === 0) return null;

  const selectedAddress =
    !useNewAddress && selectedAddressId
      ? addresses.find((a) => a.id === selectedAddressId)
      : null;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">

        {/* ── Left column: Address + Details + Notes ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* ── Section: Delivery Address ── */}
          <div className="bg-white rounded-2xl border border-stone-100 p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="h-8 w-8 bg-brand-50 rounded-lg flex items-center justify-center">
                <MapPin className="h-4 w-4 text-brand-600" />
              </div>
              <h2 className="font-bold text-gray-900">כתובת למשלוח</h2>
            </div>

            {/* Saved addresses picker */}
            {addresses.length > 0 && (
              <div className="mb-4">
                <div className="space-y-2 mb-3">
                  {addresses.map((addr) => (
                    <label
                      key={addr.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        !useNewAddress && selectedAddressId === addr.id
                          ? "border-brand-400 bg-brand-50"
                          : "border-stone-200 hover:border-brand-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="address_choice"
                        value={addr.id}
                        checked={!useNewAddress && selectedAddressId === addr.id}
                        onChange={() => {
                          setSelectedAddressId(addr.id);
                          setUseNewAddress(false);
                        }}
                        className="mt-0.5 accent-brand-600"
                      />
                      <div className="min-w-0">
                        {addr.label && (
                          <p className="text-xs font-semibold text-brand-700 mb-0.5">
                            {addr.label}
                          </p>
                        )}
                        <p className="text-sm text-gray-900">
                          {addr.street} {addr.house_number}
                          {addr.apartment ? `, ${addr.apartment}` : ""}
                        </p>
                        <p className="text-xs text-stone-500">{addr.city}</p>
                      </div>
                      {addr.is_default && (
                        <span className="shrink-0 text-xs font-semibold text-brand-600 bg-brand-50 border border-brand-200 rounded-full px-2 py-0.5">
                          ברירת מחדל
                        </span>
                      )}
                    </label>
                  ))}

                  {/* New address option */}
                  <label
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      useNewAddress
                        ? "border-brand-400 bg-brand-50"
                        : "border-stone-200 hover:border-brand-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="address_choice"
                      value="new"
                      checked={useNewAddress}
                      onChange={() => {
                        setUseNewAddress(true);
                        setSelectedAddressId(null);
                      }}
                      className="accent-brand-600"
                    />
                    <span className="text-sm font-medium text-gray-900">
                      כתובת חדשה
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* Manual address form */}
            {(useNewAddress || addresses.length === 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* City with settlement search */}
                <div className="sm:col-span-2" ref={comboboxRef}>
                  <InputField label="עיר / יישוב" id="manual_city" required>
                    <div className="relative">
                      <input
                        id="manual_city"
                        type="text"
                        value={manualCity}
                        onChange={(e) => {
                          setManualCity(e.target.value);
                          setShowSuggestions(true);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        placeholder="הקלידו שם עיר..."
                        className={inputClass}
                        autoComplete="off"
                        required
                      />
                      {showSuggestions && settlementResults.length > 0 && (
                        <ul className="absolute top-full start-0 end-0 z-20 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
                          {settlementResults.map((s) => (
                            <li key={s.name}>
                              <button
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setManualCity(s.name);
                                  setShowSuggestions(false);
                                }}
                                className="w-full text-start px-4 py-2.5 text-sm text-gray-900 hover:bg-brand-50 transition-colors"
                              >
                                {s.name}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </InputField>
                </div>

                <div className="sm:col-span-2 grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <InputField label="רחוב" id="manual_street" required>
                      <input
                        id="manual_street"
                        type="text"
                        value={manualStreet}
                        onChange={(e) => setManualStreet(e.target.value)}
                        placeholder="שם הרחוב"
                        className={inputClass}
                        required
                      />
                    </InputField>
                  </div>
                  <div>
                    <InputField label='מס׳ בית' id="manual_house" required>
                      <input
                        id="manual_house"
                        type="text"
                        value={manualHouseNumber}
                        onChange={(e) => setManualHouseNumber(e.target.value)}
                        placeholder="1"
                        className={inputClass}
                        required
                      />
                    </InputField>
                  </div>
                </div>

                <InputField label="דירה / קומה" id="manual_apartment">
                  <input
                    id="manual_apartment"
                    type="text"
                    value={manualApartment}
                    onChange={(e) => setManualApartment(e.target.value)}
                    placeholder="דירה 3, קומה 2"
                    className={inputClass}
                  />
                </InputField>
              </div>
            )}

            {/* Delivery zone info */}
            {quote ? (
              <div className="mt-4 p-3.5 rounded-xl bg-brand-50 border border-brand-100 flex items-center gap-3">
                <Truck className="h-4 w-4 text-brand-600 shrink-0" />
                <div className="text-sm">
                  <span className="font-semibold text-brand-800">{quote.zone.name}</span>
                  <span className="text-brand-600">
                    {" · "}
                    {quote.isFree ? (
                      <span className="font-semibold text-emerald-600">משלוח חינם 🎉</span>
                    ) : (
                      <>דמי משלוח {formatPrice(quote.feeAgorot)}</>
                    )}
                    {" · "}
                    {quote.zone.estimatedDays}
                  </span>
                  {!quote.isFree && quote.remainingForFree > 0 && (
                    <span className="block text-xs text-brand-500 mt-0.5">
                      עוד {formatPrice(quote.remainingForFree)} למשלוח חינם
                    </span>
                  )}
                </div>
              </div>
            ) : (
              useNewAddress && manualCity.length > 0 && !deliveryZoneSlug && (
                <div className="mt-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-3 text-sm text-amber-800">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  העיר שהזנתם אינה ברשימת היישובים שמשלוח מגיע אליהם. בחרו עיר מהרשימה.
                </div>
              )
            )}
          </div>

          {/* ── Section: Customer Details ── */}
          <div className="bg-white rounded-2xl border border-stone-100 p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="h-8 w-8 bg-brand-50 rounded-lg flex items-center justify-center">
                <User className="h-4 w-4 text-brand-600" />
              </div>
              <h2 className="font-bold text-gray-900">פרטי הלקוח</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <InputField label="שם מלא" id="customer_name" required>
                  <div className="relative">
                    <User className="absolute start-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                    <input
                      id="customer_name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="ישראל ישראלי"
                      className={`${inputClass} ps-10`}
                      required
                    />
                  </div>
                </InputField>
              </div>

              <InputField label="טלפון" id="customer_phone" required>
                <div className="relative">
                  <Phone className="absolute start-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                  <input
                    id="customer_phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0501234567"
                    dir="ltr"
                    className={`${inputClass} ps-10`}
                    required
                  />
                </div>
              </InputField>

              <InputField label="אימייל" id="customer_email" required>
                <div className="relative">
                  <Mail className="absolute start-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                  <input
                    id="customer_email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    dir="ltr"
                    className={`${inputClass} ps-10`}
                    required
                  />
                </div>
              </InputField>
            </div>
          </div>

          {/* ── Section: Notes ── */}
          <div className="bg-white rounded-2xl border border-stone-100 p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 bg-brand-50 rounded-lg flex items-center justify-center">
                <MessageSquare className="h-4 w-4 text-brand-600" />
              </div>
              <h2 className="font-bold text-gray-900">הערות למשלוח</h2>
              <span className="text-xs text-stone-400">(אופציונלי)</span>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="לדוגמה: צלצלו בדלת 2, השאירו ליד הכניסה, שעות עדיפות..."
              maxLength={300}
              rows={3}
              className="w-full px-3.5 py-3 rounded-xl border border-stone-200 bg-white text-gray-900 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow resize-none"
            />
            <p className="text-xs text-stone-400 mt-1 text-end">
              {notes.length}/300
            </p>
          </div>
        </div>

        {/* ── Right column: Order Summary ── */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-stone-100 p-5 lg:sticky lg:top-24">
            <h2 className="font-bold text-gray-900 text-lg mb-4">סיכום הזמנה</h2>

            {/* Cart items */}
            <ul className="space-y-3 mb-4">
              {items.map((item) => (
                <li key={item.variantId} className="flex items-center gap-2.5">
                  <div
                    className="h-10 w-10 rounded-lg shrink-0 flex items-center justify-center text-xl"
                    style={{ backgroundColor: item.imageColor ?? "#f0fdf0" }}
                  >
                    {item.productIcon ?? "🛒"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.productName}
                    </p>
                    <p className="text-xs text-stone-400">
                      {item.variantLabel} × {item.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 shrink-0">
                    {formatPrice(item.priceAgorot * item.quantity)}
                  </p>
                </li>
              ))}
            </ul>

            <div className="border-t border-stone-100 pt-4 space-y-2 text-sm mb-4">
              <div className="flex justify-between text-stone-600">
                <span>סכום מוצרים</span>
                <span>{formatPrice(subtotalAgorot)}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>דמי משלוח</span>
                <span>
                  {quote ? (
                    quote.isFree ? (
                      <span className="text-emerald-600 font-semibold">חינם</span>
                    ) : (
                      formatPrice(quote.feeAgorot)
                    )
                  ) : (
                    <span className="text-stone-400 text-xs">יחושב לפי אזור</span>
                  )}
                </span>
              </div>
            </div>

            <div className="border-t border-stone-200 pt-4 mb-5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-900">סה&quot;כ לתשלום</span>
                <span className="text-2xl font-bold text-brand-700">
                  {formatPrice(totalAgorot)}
                </span>
              </div>
              {!quote && (
                <p className="text-xs text-stone-400 mt-1">לא כולל דמי משלוח</p>
              )}
            </div>

            {/* Minimum order warning */}
            {quote && !quote.meetsMinimum && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                <span className="font-semibold">הזמנה מינימלית לא הושגה.</span>
                {" "}חסרים עוד {formatPrice(quote.shortfallAgorot)} להגיע למינימום של{" "}
                {formatPrice(quote.zone.minOrderAgorot)} באזור {quote.zone.name}.
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isPending || (!!quote && !quote.meetsMinimum)}
              className="w-full h-13 rounded-full bg-brand-600 text-white font-bold text-base hover:bg-brand-700 active:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md shadow-brand-600/20 flex items-center justify-center gap-2"
              style={{ height: "52px" }}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  מעבד...
                </>
              ) : (
                "המשך לתשלום"
              )}
            </button>

            <div className="flex items-center justify-center gap-1.5 mt-3 text-xs text-stone-400">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              תשלום מאובטח · Bit · כרטיס אשראי
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
