import type { Metadata } from "next";
import { SalesReportForm } from "@/components/admin/reports/SalesReportForm";

export const metadata: Metadata = { title: "דוחות כספיים" };
export const dynamic = "force-dynamic";

export default function AdminReportsPage() {
  return (
    <div className="space-y-5">
      <div className="print:hidden">
        <h1 className="text-2xl font-bold text-gray-900">דוחות מכירות האתר</h1>
        <p className="text-sm text-gray-500 mt-1">
          דוח תשלומים מרוכז לפי קבוצות אמצעי תשלום, מתוך הזמנות ששולמו בפועל באתר.
        </p>
      </div>
      <SalesReportForm />
    </div>
  );
}
