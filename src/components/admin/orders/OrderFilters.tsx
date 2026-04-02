"use client";

import { useRef, useTransition } from "react";
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
  const formRef = useRef<HTMLFormElement>(null);

  const push = (data: FormData) => {
    const params = new URLSearchParams();
    const s  = (data.get("search")  as string | null)?.trim() ?? "";
    const st = (data.get("status")  as string | null) ?? "";
    const p  = (data.get("payment") as string | null) ?? "";
    if (s)  params.set("search",  s);
    if (st) params.set("status",  st);
    if (p)  params.set("payment", p);
    startTransition(() => {
      router.push(`/admin/orders${params.size ? `?${params}` : ""}`);
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    push(new FormData(e.currentTarget));
  };

  // Selects trigger navigation immediately on change
  const handleSelectChange = () => {
    if (formRef.current) push(new FormData(formRef.current));
  };

  const hasFilters = search || statusFilter || paymentFilter;

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="flex flex-wrap gap-3 items-center"
      role="search"
      aria-label="סינון הזמנות"
    >
      {/* Text search */}
      <div className="relative flex-1 min-w-52">
        <Search
          className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-gray-400 pointer-events-none"
          aria-hidden="true"
        />
        <input
          name="search"
          type="search"
          defaultValue={search}
          placeholder="שם לקוח, טלפון, מספר הזמנה..."
          className={`${inputCls} w-full ps-9 pe-3`}
        />
      </div>

      {/* Order status filter */}
      <div className="relative">
        <select
          name="status"
          defaultValue={statusFilter}
          onChange={handleSelectChange}
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
          name="payment"
          defaultValue={paymentFilter}
          onChange={handleSelectChange}
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

      {/* Search button */}
      <button
        type="submit"
        disabled={isPending}
        className="h-10 px-4 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60 transition-colors flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed shrink-0"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Search className="h-4 w-4" aria-hidden="true" />
        )}
        חפש
      </button>

      {/* Clear filters */}
      {hasFilters && (
        <button
          type="button"
          onClick={() =>
            startTransition(() => router.push("/admin/orders"))
          }
          disabled={isPending}
          className="h-10 px-3 rounded-xl text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
          aria-label="נקה פילטרים"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          נקה
        </button>
      )}
    </form>
  );
}
