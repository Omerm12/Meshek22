export function SkeletonCard() {
  return (
    <div
      className="bg-white rounded-2xl overflow-hidden border border-stone-100 animate-pulse"
      aria-hidden="true"
    >
      {/* Image area */}
      <div className="h-44 bg-stone-100" />

      {/* Content */}
      <div className="p-4 space-y-3">
        <div className="h-2.5 bg-stone-100 rounded-full w-16" />
        <div className="h-4 bg-stone-100 rounded-full w-3/4" />
        <div className="flex gap-1.5">
          <div className="h-5 w-14 bg-stone-100 rounded-full" />
          <div className="h-5 w-14 bg-stone-100 rounded-full" />
        </div>
        <div className="flex justify-between items-end pt-2">
          <div className="h-7 w-16 bg-stone-100 rounded-full" />
          <div className="h-10 w-10 bg-stone-100 rounded-full" />
        </div>
      </div>
    </div>
  );
}
