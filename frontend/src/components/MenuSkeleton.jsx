const MenuSkeleton = () => (
  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading menu" aria-busy="true">
    {Array.from({ length: 6 }, (_, index) => (
      <div key={index} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="h-52 animate-pulse bg-slate-100" />
        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex justify-between gap-4">
            <div className="h-5 w-2/5 animate-pulse rounded bg-slate-100" />
            <div className="h-5 w-16 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="h-4 w-4/5 animate-pulse rounded bg-slate-100" />
          <div className="flex justify-between border-t border-slate-100 pt-4">
            <div className="h-4 w-28 animate-pulse rounded bg-slate-100" />
            <div className="h-9 w-28 animate-pulse rounded-xl bg-slate-100" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

export default MenuSkeleton;
