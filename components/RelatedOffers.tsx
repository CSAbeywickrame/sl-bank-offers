import Link from "next/link";
import { getCategoryLabel } from "@/lib/offers/categories";
import { getOfferHighlight } from "@/lib/offers/highlight";
import type { Offer } from "@/lib/offers/types";

/**
 * A compact list of other offers, for the two questions a detail page leaves open: could another
 * card do better at this merchant, and what else does this bank discount in this category.
 *
 * Deliberately not OfferCard — these are a sidebar to the offer being read, and full cards would
 * compete with it. Each row leads with its saving so the comparison is scannable in one pass.
 */
export function RelatedOffers({
  heading,
  description,
  offers,
  showBank = true
}: {
  heading: string;
  description?: string;
  offers: Offer[];
  showBank?: boolean;
}) {
  if (offers.length === 0) return null;

  return (
    <section className="rounded-xl border border-(--border-subtle) bg-(--surface-card) p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-(--text-strong)">{heading}</h2>
      {description && <p className="mt-1 text-sm text-(--text-muted)">{description}</p>}
      <ul className="mt-4 divide-y divide-(--border-subtle)" role="list">
        {offers.map((offer) => {
          const highlight = getOfferHighlight(offer);
          return (
            <li key={offer.id}>
              <Link
                href={`/offers/${offer.id}`}
                className="group flex items-center gap-4 py-3 transition-colors duration-(--motion-fast) hover:bg-(--surface-muted)"
              >
                <span className="w-16 shrink-0 text-right">
                  <span className="block text-lg font-bold leading-none text-(--text-link)">
                    {highlight.value ?? "—"}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-tight text-(--text-muted)">
                    {highlight.label}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-(--text-strong) group-hover:text-(--text-link)">
                    {offer.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-(--text-muted)">
                    {showBank ? offer.bankName : getCategoryLabel(offer.category)}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
