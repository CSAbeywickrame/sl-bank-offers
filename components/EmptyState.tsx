import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-neutral-300 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100">
        <svg width="28" height="28" fill="none" className="stroke-neutral-400" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </div>
      <h2 className="mt-4 text-lg font-semibold text-neutral-900">
        No offers found
      </h2>
      <p className="mt-1.5 max-w-[360px] text-sm text-neutral-500">
        No offers match your current filters. Try adjusting the bank, category, or search term.
      </p>
      <Link href="/" className={buttonClasses({ variant: "accent" }) + " mt-5"}>
        Clear filters
      </Link>
    </div>
  );
}
