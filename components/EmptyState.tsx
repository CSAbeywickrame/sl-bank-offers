import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

// No-results placeholder: dashed card, muted search glyph, headline, helper copy and a reset action
export function EmptyState() {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-(--border-default) bg-(--surface-card) px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-(--surface-muted)">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-(--text-faint)"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
          <path d="M11 8v6M8 11h6" />
        </svg>
      </div>
      <h2 className="mt-4 text-lg font-semibold text-(--text-strong)">
        No offers found
      </h2>
      <p className="mt-1.5 max-w-[360px] text-sm leading-(--lh-normal) text-(--text-muted)">
        No offers match your current filters. Try adjusting the bank, category, or search term.
      </p>
      <Link href="/" className={buttonClasses({ variant: "accent", className: "mt-5" })}>
        Clear filters
      </Link>
    </div>
  );
}
