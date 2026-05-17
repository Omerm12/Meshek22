"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";
import { ORDER_STATUS_OPTIONS, PAYMENT_STATUS_OPTIONS } from "@/lib/utils/order-status";

interface OrderFiltersProps {
  search:        string;
  statusFilter:  string;
  paymentFilter: string;
}

const inputCls =
  "h-10 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 " +
  "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow";

export function OrderFilters({ search, statusFilter, paymentFilter }: OrderFiltersProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(search);
  const [statusValue, setStatusValue] = useState(statusFilter);
  const [paymentValue, setPaymentValue] = useState(paymentFilter);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local state if server-rendered props change (browser back/forward)
  useEffect(() => { setSearchValue(search); }, [search]);
  useEffect(() => { setStatusValue(statusFilter); }, [statusFilter]);
  useEffect(() => { setPaymentValue(paymentFilter); }, [paymentFilter]);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const navigate = (s: string, st: string, p: string) => {
    const params = new URLSearchParams();
    if (s.trim()) params.set("search",  s.trim());
    if (st)       params.set("status",  st);
    if (p)        params.set("payment", p);
    startTransition(() => {
      router.push(`/admin/orders${params.size ? `?${params}` : ""}`);
    });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchValue(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navigate(val, statusValue, paymentValue), 300);
  };

  const handleSearchClear = () => {
    setSearchValue("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    navigate("", statusValue, paymentValue);
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setStatusValue(val);
    navigate(searchValue, val, paymentValue);
  };

  const handlePaymentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setPaymentValue(val);
    navigate(searchValue, statusValue, val);
  };

  const handleClearAll = () => {
    setSearchValue("");
    setStatusValue("");
    setPaymentValue("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    startTransition(() => router.push("/admin/orders"));
  };

  const hasFilters = !!(searchValue || statusValue || paymentValue);

  return (
    <div
      className="flex flex-wrap gap-3 items-center"
      role="search"
      aria-label="סינון הזמנות"
    >
      {/* Live text search */}
      <div className="relative flex-1 min-w-52">
        <div className="absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none flex items-center">
          {isPending ? (
            <Loader2 className="h-4 w-4 text-gray-400 animate-spin" aria-hidden="true" />
          ) : (
            <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />
          )}
        </div>
        <input
          type="text"
          value={searchValue}
          onChange={handleSearchChange}
          placeholder="שם לקוח, טלפון, מספר הזמנה..."
          className={`${inputCls} w-full ps-9 pe-8`}
        />
        {searchValue && (
          <button
            type="button"
            onClick={handleSearchClear}
            className="absolute top-1/2 -translate-y-1/2 end-2.5 p-0.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="נקה חיפוש"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Order status filter */}
      <div className="relative">
        <select
          value={statusValue}
          onChange={handleStatusChange}
          className={`${inputCls} px-3 pe-8 min-w-36 appearance-none cursor-pointer`}
          aria-label="סטטוס הזמנה"
        >
          <option value="">כל הסטטוסים</option>
          {ORDER_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 end-2.5 flex items-center">
          <svg className="h-3.5 w-3.5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </div>
      </div>

      {/* Payment status filter */}
      <div className="relative">
        <select
          value={paymentValue}
          onChange={handlePaymentChange}
          className={`${inputCls} px-3 pe-8 min-w-32 appearance-none cursor-pointer`}
          aria-label="סטטוס תשלום"
        >
          <option value="">כל התשלומים</option>
          {PAYMENT_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 end-2.5 flex items-center">
          <svg className="h-3.5 w-3.5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </div>
      </div>

      {/* Clear all filters */}
      {hasFilters && (
        <button
          type="button"
          onClick={handleClearAll}
          disabled={isPending}
          className="h-10 px-3 rounded-xl text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
          aria-label="נקה פילטרים"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          נקה
        </button>
      )}
    </div>
  );
}
