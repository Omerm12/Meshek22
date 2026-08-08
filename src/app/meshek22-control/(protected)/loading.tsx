/**
 * Shared loading skeleton for every administrator page.
 *
 * Streams instantly while the server resolves authorisation and data, so the
 * panel never shows a blank screen. The shapes deliberately mirror the real
 * layout (title, then stat/list rows) to avoid a visible jump when content
 * arrives. Responsive down to 375px.
 */
export default function AdminLoading() {
  return (
    <div className="space-y-8 animate-pulse" role="status" aria-label="טוען נתונים">
      <div className="space-y-2">
        <div className="h-7 w-40 rounded-lg bg-gray-200" />
        <div className="h-4 w-64 rounded bg-gray-100" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-gray-200 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-6 w-12 rounded bg-gray-200" />
              <div className="h-3 w-20 rounded bg-gray-100" />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 rounded bg-gray-200" />
                <div className="h-3 w-1/2 rounded bg-gray-100" />
              </div>
              <div className="h-9 w-20 rounded-lg bg-gray-100 shrink-0" />
            </div>
          </div>
        ))}
      </div>

      <span className="sr-only">טוען…</span>
    </div>
  );
}
