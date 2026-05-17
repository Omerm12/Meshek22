import Link from "next/link";
import { ChevronRight, ChevronLeft } from "lucide-react";

interface AdminPaginationProps {
  page: number;
  totalPages: number;
  prevHref: string | null;
  nextHref: string | null;
}

export function AdminPagination({ page, totalPages, prevHref, nextHref }: AdminPaginationProps) {
  if (totalPages <= 1) return null;

  const btnBase =
    "inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-medium border transition-colors";
  const btnActive = `${btnBase} text-gray-600 border-gray-200 hover:bg-gray-100 hover:border-gray-300`;
  const btnDisabled = `${btnBase} text-gray-300 border-gray-100 cursor-not-allowed`;

  return (
    <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
      {/* Previous (RTL: arrow pointing right = go back) */}
      {prevHref ? (
        <Link href={prevHref} className={btnActive}>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
          הקודם
        </Link>
      ) : (
        <span className={btnDisabled}>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
          הקודם
        </span>
      )}

      <span className="text-sm text-gray-500">
        עמוד{" "}
        <span className="font-semibold text-gray-900">{page}</span>
        {" "}מתוך{" "}
        <span className="font-semibold text-gray-900">{totalPages}</span>
      </span>

      {/* Next (RTL: arrow pointing left = go forward) */}
      {nextHref ? (
        <Link href={nextHref} className={btnActive}>
          הבא
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : (
        <span className={btnDisabled}>
          הבא
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </span>
      )}
    </div>
  );
}
