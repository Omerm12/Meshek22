import { AlertTriangle } from "lucide-react";

/**
 * Shown when the product form cannot offer any category.
 *
 * Almost always this means a migration has not been applied yet — the categories
 * table or one of its columns is missing. A 404 would send the shop owner
 * looking for a broken link; this says what is actually wrong and what to do.
 *
 * The underlying database message is logged server-side only, never rendered.
 */
export function CategoryLoadError({
  detail,
  empty = false,
}: {
  detail?: string;
  empty?: boolean;
}) {
  if (detail) {
    console.error("[admin:products] category load failed", { message: detail });
  }

  return (
    <div className="max-w-2xl">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h1 className="font-bold text-amber-900 mb-2">לא ניתן לטעון את רשימת הקטגוריות</h1>
            {empty ? (
              <p className="text-sm text-amber-800 leading-relaxed">
                אין עדיין קטגוריות פעילות במערכת, ולכן לא ניתן ליצור מוצר.
                צרו קטגוריה אחת לפחות ונסו שוב.
              </p>
            ) : (
              <p className="text-sm text-amber-800 leading-relaxed">
                נראה שעדכון מסד הנתונים האחרון טרם הוחל. יש להריץ את קובצי המיגרציה
                בתיקיית <span className="font-mono text-xs">supabase/migrations</span> ואז לרענן את הדף.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
