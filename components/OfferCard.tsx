import Link from "next/link";
import { getCategoryLabel } from "@/lib/offers/categories";
import { isExpiringSoon } from "@/lib/offers/expiry";
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

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-(--border-subtle) bg-(--surface-card) shadow-sm transition-[box-shadow,border-color,transform] duration-(--motion-med) ease-out hover:-translate-y-1 hover:border-(--border-default) hover:shadow-lg motion-reduce:hover:translate-y-0">
      {/* Navy-to-emerald top rule */}
      <div aria-hidden="true" className="h-1 shrink-0" style={{ background: "var(--offer-rule)" }} />

      <div className="flex flex-1 flex-col gap-4 p-5">
        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="bank">{offer.bankName}</Badge>
          <Badge tone="category">{getCategoryLabel(offer.category)}</Badge>
          {expiringSoon && <Badge tone="expiry">Expiring soon</Badge>}
        </div>

        {/* Content */}
        <div className="flex-1">
          {offer.merchant && (
            <p className="mb-1 text-xs font-semibold uppercase tracking-(--ls-wide) text-(--text-link)">
              {offer.merchant}
            </p>
          )}
          <h2 className="text-base font-semibold leading-snug text-(--text-strong) transition-colors duration-(--motion-fast) group-hover:text-(--text-link)">
            {offer.title}
          </h2>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-(--text-muted)">
            {offer.description}
          </p>
        </div>

        {/* Validity grid — T3.2 adds the design system's "Min. spend" cell here when offer.minSpend is set */}
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-md bg-(--surface-muted) px-3 py-2.5 text-xs">
          <div>
            <dt className="font-semibold text-(--text-strong)">Valid until</dt>
            <dd className={expiringSoon ? "mt-0.5 font-medium text-red-600" : "mt-0.5 text-(--text-body)"}>
              {formatDate(offer.validUntil)}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-(--text-strong)">Last checked</dt>
            <dd className="mt-0.5 text-(--text-body)">{formatDate(offer.lastCheckedAt)}</dd>
          </div>
        </dl>

        {/* CTA row — side by side to keep the card compact; navy = primary, emerald outline = secondary */}
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
