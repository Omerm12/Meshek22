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
  Store,
  AlertCircle,
  ShieldCheck,
  Loader2,
  Banknote,
  PhoneCall,
  CreditCard,
  Tag,
} from "lucide-react";
import Image from "next/image";
import { useCart } from "@/store/cart";
import { formatPrice } from "@/lib/utils/money";
import supabaseImageLoader from "@/lib/utils/supabase-image-loader";
import { getDeliveryQuote } from "@/lib/delivery";
import type { DeliveryZone } from "@/lib/delivery";
import { createOrder } from "@/app/(shop)/checkout/actions";
import type { CheckoutSettlement } from "@/app/(shop)/checkout/page";
import { PaymentRedirectOverlay } from "@/components/checkout/PaymentRedirectOverlay";
import { formatPromotionProgress } from "@/lib/promotions/engine";
import {
  PICKUP_LOCATION,
  type FulfillmentMethod,
  type PaymentMethod,
} from "@/lib/checkout/constants";

interface CheckoutFormProps {
  /** Active delivery zones fetched from DB at page-render time. */
  deliveryZones: DeliveryZone[];
  /** Active settlements fetched from DB — used for autocomplete and zone resolution. */
  settlements: CheckoutSettlement[];
}

function InputField({
  label,
  id,
  required,
  error,
  children,
}: {
  label: string;
  id: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ms-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}

const inputClass =
  "w-full h-11 px-3.5 rounded-xl border border-stone-200 bg-white text-gray-900 text-base sm:text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow";

/** Radio card used for both the fulfillment and the payment choice. */
function ChoiceCard({
  checked,
  onSelect,
  name,
  value,
  icon,
  title,
  description,
}: {
  checked: boolean;
  onSelect: () => void;
  name: string;
  value: string;
  icon: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <label
      className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors min-h-[56px] ${
        checked ? "border-brand-400 bg-brand-50" : "border-stone-200 hover:border-brand-300"
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onSelect}
        className="mt-1 accent-brand-600 h-4 w-4 shrink-0"
      />
      <span className="mt-0.5 text-brand-600 shrink-0" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-gray-900">{title}</span>
        {description && (
          <span className="block text-xs text-stone-500 mt-0.5 leading-relaxed">{description}</span>
        )}
      </span>
    </label>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CheckoutForm({ deliveryZones, settlements }: CheckoutFormProps) {
  const router = useRouter();
  const { items, subtotalAgorot, isHydrated, pricing } = useCart();

  // ── Fulfillment + payment ──────────────────────────────────────────────────
  const [fulfillment, setFulfillment] = useState<FulfillmentMethod>("delivery");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("credit_card");

  // ── Address state ──────────────────────────────────────────────────────────
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [apartment, setApartment] = useState("");

  const [showSuggestions, setShowSuggestions] = useState(false);
  const comboboxRef = useRef<HTMLDivElement>(null);

  // The zone is resolved exclusively from the DB settlements list passed as a
  // prop; the server re-resolves and re-prices it regardless.
  const findZoneIdByCity = (name: string): string | null =>
    settlements.find((s) => s.name === name)?.delivery_zone_id ?? null;

  const [deliveryZoneId, setDeliveryZoneId] = useState<string | null>(null);

  // ── Customer details ───────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  // ── Idempotency key ────────────────────────────────────────────────────────
  // Generated once per component mount. Survives re-renders but is discarded on
  // navigation, so each new checkout session gets a fresh key and a resubmission
  // of the same session returns the same order instead of creating a second one.
  const idempotencyKeyRef = useRef<string | null>(null);
  if (idempotencyKeyRef.current === null) {
    idempotencyKeyRef.current = crypto.randomUUID();
  }

  // ── Submission ─────────────────────────────────────────────────────────────
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [redirectingTo, setRedirectingTo] = useState<string | null>(null);

  const navigatingAwayRef = useRef(false);

  // ── Redirect if cart empty ─────────────────────────────────────────────────
  useEffect(() => {
    if (isHydrated && items.length === 0 && !navigatingAwayRef.current) {
      router.replace("/cart");
    }
  }, [isHydrated, items.length, router]);

  // ── Update zone when city changes ─────────────────────────────────────────
  useEffect(() => {
    setDeliveryZoneId(findZoneIdByCity(city));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, settlements]);

  // ── Click-outside to close suggestions ────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Restore draft saved before a CardCom redirect ─────────────────────────
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("meshek22_checkout_draft");
      if (!raw) return;
      const d = JSON.parse(raw) as Partial<{
        name: string; phone: string; email: string; notes: string;
        city: string; street: string; houseNumber: string; apartment: string;
        fulfillment: FulfillmentMethod; paymentMethod: PaymentMethod;
      }>;
      if (d.name        !== undefined) setName(d.name);
      if (d.phone       !== undefined) setPhone(d.phone);
      if (d.email       !== undefined) setEmail(d.email);
      if (d.notes       !== undefined) setNotes(d.notes);
      if (d.city        !== undefined) setCity(d.city);
      if (d.street      !== undefined) setStreet(d.street);
      if (d.houseNumber !== undefined) setHouseNumber(d.houseNumber);
      if (d.apartment   !== undefined) setApartment(d.apartment);
      if (d.fulfillment === "delivery" || d.fulfillment === "pickup") setFulfillment(d.fulfillment);
      if (d.paymentMethod) setPaymentMethod(d.paymentMethod);
    } catch {}
  }, []);

  // ── Settlement autocomplete ────────────────────────────────────────────────
  const settlementResults = useMemo(() => {
    const q = city.trim().toLowerCase();
    if (q.length < 2) return [];
    return settlements.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 8);
  }, [city, settlements]);

  // ── Zone + quote ───────────────────────────────────────────────────────────
  const isDelivery = fulfillment === "delivery";

  const selectedZone = useMemo(
    () => (deliveryZoneId ? deliveryZones.find((z) => z.id === deliveryZoneId) ?? null : null),
    [deliveryZoneId, deliveryZones]
  );

  // Minimums and free-delivery thresholds are judged on what the customer
  // actually pays for goods, i.e. after promotions.
  const goodsTotal = pricing.chargedSubtotalAgorot;

  const quote = useMemo(
    () => (isDelivery && selectedZone ? getDeliveryQuote(selectedZone, goodsTotal) : null),
    [isDelivery, selectedZone, goodsTotal]
  );

  const deliveryFeeAgorot = isDelivery ? quote?.feeAgorot ?? 0 : 0;
  const totalAgorot = goodsTotal + deliveryFeeAgorot;
  const belowMinimum = isDelivery && !!quote && !quote.meetsMinimum;

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = (): string | null => {
    if (name.trim().length < 2) return "נא להזין שם מלא";
    if (!/^0\d{8,9}$/.test(phone.replace(/[-\s]/g, "")))
      return "מספר טלפון לא תקין (לדוגמה: 0501234567)";

    // Email is required for the online-card flow because CardCom sends the
    // receipt to it; optional otherwise, but validated when supplied.
    if (paymentMethod === "credit_card" && !email.trim()) {
      return "נא להזין כתובת אימייל לקבלת אישור התשלום";
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return "כתובת אימייל לא תקינה";

    if (isDelivery) {
      if (!city.trim())        return "נא להזין עיר / יישוב";
      if (!deliveryZoneId)     return "לא ניתן לזהות את אזור המשלוח. נא לבחור עיר מהרשימה.";
      if (!street.trim())      return "נא להזין שם רחוב";
      if (!houseNumber.trim()) return "נא להזין מספר בית";
      if (quote && !quote.meetsMinimum) return `ההזמנה המינימלית ל${city} לא הושגה.`;
    }
    return null;
  };

  // ── Form submission ────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsPending(true);

    const fd = new FormData();
    fd.set("idempotency_key",    idempotencyKeyRef.current!);
    fd.set("fulfillment_method", fulfillment);
    fd.set("payment_method",     paymentMethod);
    // Only variant ids and quantities are sent. Prices, promotions and totals
    // are recomputed on the server from the database.
    fd.set("cart_items", JSON.stringify(
      items.map((i) => ({ variantId: i.variantId, quantity: i.quantity }))
    ));
    fd.set("customer_name",  name);
    fd.set("customer_phone", phone);
    fd.set("customer_email", email);
    fd.set("delivery_notes", notes);

    if (isDelivery) {
      fd.set("delivery_zone_id",     deliveryZoneId!);
      fd.set("address_city",         city);
      fd.set("address_street",       street);
      fd.set("address_house_number", houseNumber);
      fd.set("address_apartment",    apartment);
    }

    try {
      const result = await createOrder(fd);

      if ("error" in result) {
        setError(result.error);
        setIsPending(false);
        return;
      }

      // Persist the form so the customer can pick up where they left off if they
      // come back from CardCom (browser back, or the payment-error page).
      try {
        sessionStorage.setItem(
          "meshek22_checkout_draft",
          JSON.stringify({ name, phone, email, notes, city, street, houseNumber, apartment, fulfillment, paymentMethod })
        );
      } catch {}

      navigatingAwayRef.current = true;

      if (result.paymentUrl) {
        // Online card: the cart is NOT cleared here — only after the webhook
        // verifies the payment. A cancelled payment leaves the basket intact.
        setRedirectingTo(result.paymentUrl);
      } else {
        // Cash / phone-credit: the order is already accepted, so the success
        // page clears the cart once it confirms the order exists.
        window.location.href = result.successUrl;
      }
    } catch {
      setError("שגיאה לא צפויה. נא לנסות שוב.");
      setIsPending(false);
    }
  };

  if (!isHydrated || items.length === 0) return null;

  if (redirectingTo) return <PaymentRedirectOverlay paymentUrl={redirectingTo} />;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">

        {/* ── Left column ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* ── Fulfillment method ── */}
          <div className="bg-white rounded-2xl border border-stone-100 p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="h-8 w-8 bg-brand-50 rounded-lg flex items-center justify-center">
                <Truck className="h-4 w-4 text-brand-600" />
              </div>
              <h2 className="font-bold text-gray-900">אופן קבלת ההזמנה</h2>
            </div>

            <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <legend className="sr-only">בחירת אופן קבלת ההזמנה</legend>
              <ChoiceCard
                name="fulfillment_method"
                value="delivery"
                checked={isDelivery}
                onSelect={() => setFulfillment("delivery")}
                icon={<Truck className="h-4 w-4" />}
                title="משלוח"
                description="עד הבית, לפי אזור החלוקה"
              />
              <ChoiceCard
                name="fulfillment_method"
                value="pickup"
                checked={!isDelivery}
                onSelect={() => setFulfillment("pickup")}
                icon={<Store className="h-4 w-4" />}
                title="איסוף עצמי"
                description="ללא דמי משלוח"
              />
            </fieldset>

            {!isDelivery && (
              <div className="mt-4 p-3.5 rounded-xl bg-brand-50 border border-brand-100 flex items-start gap-3">
                <Store className="h-4 w-4 text-brand-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="text-sm">
                  <p className="font-semibold text-brand-800">{PICKUP_LOCATION.name}</p>
                  <p className="text-brand-600 text-xs mt-1 leading-relaxed">
                    {PICKUP_LOCATION.coordinationNote}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Delivery address (delivery only) ── */}
          {isDelivery && (
            <div className="bg-white rounded-2xl border border-stone-100 p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="h-8 w-8 bg-brand-50 rounded-lg flex items-center justify-center">
                  <MapPin className="h-4 w-4 text-brand-600" />
                </div>
                <h2 className="font-bold text-gray-900">כתובת למשלוח</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2" ref={comboboxRef}>
                  <InputField label="עיר / יישוב" id="manual_city" required>
                    <div className="relative">
                      <input
                        id="manual_city"
                        type="text"
                        value={city}
                        onChange={(e) => { setCity(e.target.value); setShowSuggestions(true); }}
                        onFocus={() => setShowSuggestions(true)}
                        placeholder="הקלידו שם עיר..."
                        className={inputClass}
                        autoComplete="address-level2"
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
                                  setCity(s.name);
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
                        value={street}
                        onChange={(e) => setStreet(e.target.value)}
                        placeholder="שם הרחוב"
                        className={inputClass}
                        autoComplete="address-line1"
                        required
                      />
                    </InputField>
                  </div>
                  <div>
                    <InputField label="מס׳ בית" id="manual_house" required>
                      <input
                        id="manual_house"
                        type="text"
                        value={houseNumber}
                        onChange={(e) => setHouseNumber(e.target.value)}
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
                    value={apartment}
                    onChange={(e) => setApartment(e.target.value)}
                    placeholder="דירה 3, קומה 2"
                    className={inputClass}
                  />
                </InputField>
              </div>

              {/* Delivery zone info */}
              {quote ? (
                <div className="mt-4 p-3.5 rounded-xl bg-brand-50 border border-brand-100 flex items-center gap-3">
                  <Truck className="h-4 w-4 text-brand-600 shrink-0" />
                  <div className="text-sm">
                    <span className="font-semibold text-brand-800">{city}</span>
                    <span className="text-brand-600">
                      {" · "}
                      {quote.isFree ? (
                        <span className="font-semibold text-emerald-600">משלוח חינם 🎉</span>
                      ) : (
                        <>דמי משלוח {formatPrice(quote.feeAgorot)}</>
                      )}
                    </span>
                    {!quote.isFree && quote.remainingForFree > 0 && (
                      <span className="block text-xs text-brand-500 mt-0.5">
                        עוד {formatPrice(quote.remainingForFree)} למשלוח חינם
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                city.length > 0 && !deliveryZoneId && (
                  <div className="mt-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-3 text-sm text-amber-800">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    העיר שהזנתם אינה ברשימת היישובים שמשלוח מגיע אליהם. בחרו עיר מהרשימה.
                  </div>
                )
              )}
            </div>
          )}

          {/* ── Customer Details ── */}
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
                      autoComplete="name"
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
                    className={`${inputClass} pe-10`}
                    autoComplete="tel"
                    required
                  />
                </div>
              </InputField>

              <InputField
                label={paymentMethod === "credit_card" ? "אימייל" : "אימייל (לא חובה)"}
                id="customer_email"
                required={paymentMethod === "credit_card"}
              >
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
                    autoComplete="email"
                    required={paymentMethod === "credit_card"}
                  />
                </div>
              </InputField>
            </div>
          </div>

          {/* ── Payment method ── */}
          <div className="bg-white rounded-2xl border border-stone-100 p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="h-8 w-8 bg-brand-50 rounded-lg flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-brand-600" />
              </div>
              <h2 className="font-bold text-gray-900">אמצעי תשלום</h2>
            </div>

            <fieldset className="flex flex-col gap-3">
              <legend className="sr-only">בחירת אמצעי תשלום</legend>
              <ChoiceCard
                name="payment_method"
                value="credit_card"
                checked={paymentMethod === "credit_card"}
                onSelect={() => setPaymentMethod("credit_card")}
                icon={<ShieldCheck className="h-4 w-4" />}
                title="תשלום מאובטח באשראי באתר"
                description="מעבר לעמוד תשלום מאובטח"
              />
              <ChoiceCard
                name="payment_method"
                value="cash"
                checked={paymentMethod === "cash"}
                onSelect={() => setPaymentMethod("cash")}
                icon={<Banknote className="h-4 w-4" />}
                title="תשלום במזומן בעת קבלת ההזמנה"
                description={
                  isDelivery
                    ? "התשלום נגבה בעת מסירת המשלוח"
                    : "התשלום נגבה בעת האיסוף במשק"
                }
              />
              <ChoiceCard
                name="payment_method"
                value="phone_credit"
                checked={paymentMethod === "phone_credit"}
                onSelect={() => setPaymentMethod("phone_credit")}
                icon={<PhoneCall className="h-4 w-4" />}
                title="נציג יתקשר לקבלת פרטי אשראי"
                description="לא נבקש פרטי אשראי באתר"
              />
            </fieldset>
          </div>

          {/* ── Notes ── */}
          <div className="bg-white rounded-2xl border border-stone-100 p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 bg-brand-50 rounded-lg flex items-center justify-center">
                <MessageSquare className="h-4 w-4 text-brand-600" />
              </div>
              <h2 className="font-bold text-gray-900">
                {isDelivery ? "הערות למשלוח" : "הערות להזמנה"}
              </h2>
              <span className="text-xs text-stone-400">(אופציונלי)</span>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              aria-label={isDelivery ? "הערות למשלוח" : "הערות להזמנה"}
              placeholder={
                isDelivery
                  ? "לדוגמה: צלצלו בדלת 2, השאירו ליד הכניסה, שעות עדיפות..."
                  : "לדוגמה: שעות נוחות לאיסוף..."
              }
              maxLength={300}
              rows={3}
              className="w-full px-3.5 py-3 rounded-xl border border-stone-200 bg-white text-gray-900 text-base sm:text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow resize-none"
            />
            <p className="text-xs text-stone-400 mt-1 text-end">{notes.length}/300</p>
          </div>
        </div>

        {/* ── Right column: Order Summary ── */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-stone-100 p-5 lg:sticky lg:top-24">
            <h2 className="font-bold text-gray-900 text-lg mb-4">סיכום הזמנה</h2>

            <ul className="space-y-3 mb-4">
              {items.map((item) => {
                const line = pricing.lines.find((l) => l.variantId === item.variantId);
                const normal  = line?.normalTotalAgorot  ?? Math.round(item.priceAgorot * item.quantity);
                const charged = line?.chargedTotalAgorot ?? normal;
                return (
                  <li key={item.variantId} className="flex items-center gap-2.5">
                    <div
                      className="h-10 w-10 rounded-lg shrink-0 relative overflow-hidden"
                      style={{ backgroundColor: item.imageColor ?? "#f0fdf0" }}
                    >
                      {item.imageUrl ? (
                        <Image
                          loader={supabaseImageLoader}
                          src={item.imageUrl}
                          alt={item.productName}
                          fill
                          sizes="40px"
                          className="object-contain p-0.5"
                        />
                      ) : (
                        <span className="absolute inset-0 flex items-center justify-center text-xl">
                          {item.productIcon ?? "🛒"}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.productName}</p>
                      <p className="text-xs text-stone-400">{item.variantLabel} × {item.quantity}</p>
                    </div>
                    <p className={`text-sm font-semibold shrink-0 ${charged < normal ? "text-orange-600" : "text-gray-900"}`}>
                      {formatPrice(charged)}
                    </p>
                  </li>
                );
              })}
            </ul>

            {/* Applied promotions */}
            {pricing.appliedPromotions.length > 0 && (
              <div className="mb-4 rounded-xl bg-orange-50 border border-orange-100 p-3">
                <p className="text-xs font-bold text-orange-800 mb-1.5">מבצעים שהופעלו</p>
                <ul className="space-y-1">
                  {pricing.appliedPromotions.map((promo) => (
                    <li key={promo.promotionId} className="flex justify-between gap-2 text-xs text-orange-700">
                      <span>
                        {promo.name}
                        {promo.groupsApplied > 1 && ` × ${promo.groupsApplied}`}
                      </span>
                      <span className="font-semibold shrink-0">−{formatPrice(promo.discountAgorot)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {pricing.progress.length > 0 && (
              <div className="mb-4 rounded-xl bg-stone-50 border border-stone-100 p-3">
                {pricing.progress.slice(0, 2).map((p) => (
                  <p key={p.promotionId} className="flex items-start gap-1.5 text-xs text-stone-600 leading-relaxed">
                    <Tag className="h-3.5 w-3.5 shrink-0 mt-0.5 text-orange-500" aria-hidden="true" />
                    {formatPromotionProgress(p)}
                  </p>
                ))}
              </div>
            )}

            <div className="border-t border-stone-100 pt-4 space-y-2 text-sm mb-4">
              <div className="flex justify-between text-stone-600">
                <span>סכום מוצרים</span>
                <span>{formatPrice(subtotalAgorot)}</span>
              </div>
              {pricing.discountAgorot > 0 && (
                <div className="flex justify-between">
                  <span className="text-orange-600 font-medium">הנחת מבצעים</span>
                  <span className="text-orange-600 font-semibold">
                    −{formatPrice(pricing.discountAgorot)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-stone-600">
                <span>{isDelivery ? "דמי משלוח" : "איסוף עצמי"}</span>
                <span>
                  {!isDelivery ? (
                    <span className="text-emerald-600 font-semibold">ללא עלות</span>
                  ) : quote ? (
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
                <span className="text-2xl font-bold text-brand-700">{formatPrice(totalAgorot)}</span>
              </div>
              {isDelivery && !quote && (
                <p className="text-xs text-stone-400 mt-1">לא כולל דמי משלוח</p>
              )}
            </div>

            {/* Minimum order warning */}
            {belowMinimum && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                <span className="font-semibold">הזמנה מינימלית לא הושגה.</span>{" "}
                חסרים עוד {formatPrice(quote!.shortfallAgorot)} להגיע למינימום של{" "}
                {formatPrice(selectedZone!.min_order_agorot!)} ל{city}.
              </div>
            )}

            {/* Error */}
            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-sm text-red-700"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isPending || belowMinimum}
              className="w-full rounded-full bg-brand-600 text-white font-bold text-base hover:bg-brand-700 active:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md shadow-brand-600/20 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              style={{ height: "52px" }}
            >
              {isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" />מעבד...</>
              ) : paymentMethod === "credit_card" ? (
                <><ShieldCheck className="h-4 w-4" />מעבר לתשלום מאובטח</>
              ) : (
                <>שליחת ההזמנה</>
              )}
            </button>

            <div className="flex items-center justify-center gap-1.5 mt-3 text-xs text-stone-400 text-center">
              {paymentMethod === "credit_card" ? (
                <>
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                  תשלום מאובטח · Bit · כרטיס אשראי
                </>
              ) : paymentMethod === "cash" ? (
                <span>התשלום יבוצע במזומן בעת קבלת ההזמנה</span>
              ) : (
                <span>נציג יצור אתכם קשר לקבלת פרטי האשראי</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
