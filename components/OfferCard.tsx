import Link from "next/link";
import type { ReactNode } from "react";
import { getCategoryLabel } from "@/lib/offers/categories";
import { isExpiringSoon } from "@/lib/offers/expiry";
import { formatCardEligibility, formatLkr, formatValidDays, getOfferHighlight } from "@/lib/offers/highlight";
import type { Offer } from "@/lib/offers/types";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";

function formatDate(value: string | undefined): string {
  if (!value) return "Not specified";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not specified";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}

export function OfferCard({ offer }: { offer: Offer }) {
  const expiringSoon = isExpiringSoon(offer.validUntil);
  const highlight = getOfferHighlight(offer);
  const days = formatValidDays(offer.validDays);
  const eligibility = formatCardEligibility(offer);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-(--border-subtle) bg-(--surface-card) shadow-sm transition-[box-shadow,border-color,transform] duration-(--motion-med) ease-out hover:-translate-y-1 hover:border-(--border-default) hover:shadow-lg motion-reduce:hover:translate-y-0">
      <div aria-hidden="true" className="h-1 shrink-0" style={{ background: "var(--offer-rule)" }} />

      <div className="flex flex-1 flex-col gap-4 p-5">
        {/* The saving leads, because it is the one thing a shopper scans for. The bank sits beside
            it rather than above it: the bank decides whether an offer is usable, not whether it is
            worth reading. */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {highlight.value ? (
              <p className="flex items-baseline gap-1.5">
                <span
                  className="font-bold leading-none tracking-(--ls-tight) text-(--text-link)"
                  style={{ fontSize: "34px" }}
                >
                  {highlight.value}
                </span>
                <span className="text-sm font-semibold text-(--text-body)">{highlight.label}</span>
              </p>
            ) : (
              <p className="text-lg font-bold leading-tight text-(--text-link)">{highlight.label}</p>
            )}
            {offer.merchant && (
              <p className="mt-1 truncate text-xs font-semibold uppercase tracking-(--ls-wide) text-(--text-muted)">
                {offer.merchant}
              </p>
            )}
          </div>
          <Badge tone="bank">{offer.bankName}</Badge>
        </div>

        <div className="flex-1">
          <h2 className="text-base font-semibold leading-snug text-(--text-strong) transition-colors duration-(--motion-fast) group-hover:text-(--text-link)">
            {offer.title}
          </h2>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-(--text-muted)">{offer.description}</p>
        </div>

        {/* Terms a shopper needs BEFORE clicking: which cards qualify, which days, what they have
            to spend. Each chip appears only when the offer states it, so the row stays short rather
            than padded with "Not specified". */}
        {(eligibility || days || offer.minSpend !== undefined) && (
          <ul className="flex flex-wrap gap-1.5 text-xs" role="list">
            {eligibility && <TermChip>{eligibility}</TermChip>}
            {days && <TermChip>{days}</TermChip>}
            {offer.minSpend !== undefined && <TermChip>Min {formatLkr(offer.minSpend)}</TermChip>}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="category">{getCategoryLabel(offer.category)}</Badge>
          {expiringSoon && <Badge tone="expiry">Expiring soon</Badge>}
          <span className="ml-auto text-xs text-(--text-muted)">
            {offer.validUntil ? `Until ${formatDate(offer.validUntil)}` : "No end date"}
          </span>
        </div>

        <div className="mt-auto flex flex-wrap gap-2">
          <Link
            className={buttonClasses({ variant: "primary", className: "min-w-30 flex-1" })}
            href={`/offers/${offer.id}`}
          >
            View details
          </Link>
          <a
            className={buttonClasses({ variant: "outline", className: "min-w-30 flex-1" })}
            href={offer.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            View at bank
          </a>
        </div>
      </div>
    </article>
  );
}

function TermChip({ children }: { children: ReactNode }) {
  return (
    <li className="rounded-(--radius-sm) bg-(--surface-muted) px-2 py-1 font-medium text-(--text-body)">
      {children}
    </li>
  );
}
