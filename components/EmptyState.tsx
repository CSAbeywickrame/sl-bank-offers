import Link from "next/link";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
        <svg
          className="h-7 w-7 text-slate-400"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
          <path d="M11 8v6M8 11h6" strokeLinecap="round" />
          <line x1="9" y1="9" x2="13" y2="13" strokeLinecap="round" />
        </svg>
      </div>
      <h2 className="mt-4 text-lg font-semibold text-slate-900">No offers found</h2>
      <p className="mt-1.5 max-w-sm text-sm text-slate-500">
        No offers match your current filters. Try adjusting the bank, category, or search term.
      </p>
      <Link
        href="/"
        className="mt-5 inline-flex items-center rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 transition-colors"
      >
        Clear filters
      </Link>
    </div>
  );
}
