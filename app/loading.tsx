// Skeleton placeholder shown while the home page data loads
function LoadingCard() {
  return (
    <div className="grid min-h-[22rem] gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex gap-2">
        <div className="h-6 w-28 animate-pulse rounded-full bg-slate-200" />
        <div className="h-6 w-20 animate-pulse rounded-full bg-slate-200" />
      </div>
      <div className="space-y-3">
        <div className="h-6 w-4/5 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="mt-auto space-y-2">
        <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
      </div>
    </div>
  );
}

// Full-page loading skeleton matching the home page layout
export default function Loading() {
  return (
    <main>
      <section className="bg-slate-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-8 md:grid-cols-[1fr_auto] md:items-end">
          <div className="max-w-3xl space-y-3">
            <div className="h-4 w-40 animate-pulse rounded bg-white/20" />
            <div className="h-10 w-3/4 animate-pulse rounded bg-white/20" />
            <div className="h-4 w-full animate-pulse rounded bg-white/10" />
          </div>
          <div className="rounded-lg border border-white/15 bg-white/10 px-4 py-3">
            <div className="h-8 w-16 animate-pulse rounded bg-white/20" />
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-3 px-4 py-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_2fr_auto]">
          <div className="h-11 animate-pulse rounded-md bg-slate-100" />
          <div className="h-11 animate-pulse rounded-md bg-slate-100" />
          <div className="h-11 animate-pulse rounded-md bg-slate-100" />
          <div className="h-11 animate-pulse rounded-md bg-slate-100" />
          <div className="h-11 animate-pulse rounded-md bg-slate-200" />
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-6 md:grid-cols-2 xl:grid-cols-3">
        <LoadingCard />
        <LoadingCard />
        <LoadingCard />
      </section>
    </main>
  );
}
