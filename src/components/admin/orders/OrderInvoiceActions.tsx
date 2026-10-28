import { FileText, Printer } from "lucide-react";
import { ADMIN_BASE_PATH } from "@/lib/admin/routes";
import {
  invoiceUnavailableMessage,
  resolveInvoiceReference,
  type InvoiceOrderFacts,
} from "@/lib/cardcom-documents";

/**
 * "View / print invoice" for a paid card order, or a clear Hebrew status when
 * Cardcom has no invoice for it. Plain links to the admin-only invoice route —
 * no client code, no credentials, nothing is created by clicking.
 */
export function OrderInvoiceActions({ order }: { order: InvoiceOrderFacts }) {
  const reference = resolveInvoiceReference(order);

  // Unpaid orders and non-card payments are never offered an invoice.
  if (reference.kind === "unavailable") {
    const message = invoiceUnavailableMessage(reference.reason);
    if (!message) return null;
    return <p className="text-sm text-gray-500">{message}</p>;
  }

  const href = `${ADMIN_BASE_PATH}/orders/${order.id}/invoice`;
  const button =
    "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <a href={href} target="_blank" rel="noopener noreferrer" className={button}>
          <FileText className="h-4 w-4" aria-hidden="true" />
          צפייה בחשבונית
        </a>
        <a href={`${href}?print=1`} target="_blank" rel="noopener noreferrer" className={button}>
          <Printer className="h-4 w-4" aria-hidden="true" />
          הדפסת חשבונית
        </a>
      </div>
      <p className="text-xs text-gray-400" dir="ltr">
        {reference.documentType} #{reference.documentNumber}
      </p>
    </div>
  );
}
