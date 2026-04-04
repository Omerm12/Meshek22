export interface StatusEntry {
  label: string;
  cls:   string; // Tailwind classes for the badge
}

export const ORDER_STATUS_MAP: Record<string, StatusEntry> = {
  pending_payment:  { label: "ממתין לתשלום", cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  confirmed:        { label: "אושר",          cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  preparing:        { label: "בהכנה",         cls: "bg-purple-50 text-purple-700 border-purple-200" },
  out_for_delivery: { label: "בדרך",          cls: "bg-orange-50 text-orange-700 border-orange-200" },
  delivered:        { label: "סופק",          cls: "bg-green-50  text-green-700  border-green-200"  },
  cancelled:        { label: "בוטל",          cls: "bg-gray-100  text-gray-500   border-gray-200"   },
};

export const PAYMENT_STATUS_MAP: Record<string, StatusEntry> = {
  pending:  { label: "ממתין", cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  paid:     { label: "שולם",  cls: "bg-green-50  text-green-700  border-green-200"  },
  failed:   { label: "נכשל", cls: "bg-red-50    text-red-700    border-red-200"    },
  refunded: { label: "הוחזר", cls: "bg-gray-100  text-gray-500   border-gray-200"   },
};

// Select options used in filter dropdowns and OrderStatusSelect
export const ORDER_STATUS_OPTIONS = Object.entries(ORDER_STATUS_MAP).map(
  ([value, { label }]) => ({ value, label })
);
export const PAYMENT_STATUS_OPTIONS = Object.entries(PAYMENT_STATUS_MAP).map(
  ([value, { label }]) => ({ value, label })
);
