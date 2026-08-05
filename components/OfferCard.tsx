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
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition-all duration-150 hover:border-neutral-300 hover:shadow-md">
      {/* Navy-to-emerald top rule */}
      <div style={{ height: "4px", background: "var(--offer-rule)", flexShrink: 0 }} />

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
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.04em] text-emerald-700">
              {offer.merchant}
            </p>
          )}
          <h2 className="text-base font-semibold leading-snug text-neutral-900 transition-colors duration-150 group-hover:text-emerald-700">
            {offer.title}
          </h2>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-neutral-600">
            {offer.description}
          </p>
        </div>

        {/* Validity grid */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md bg-neutral-100 px-3 py-2.5 text-xs">
          <div>
            <dt className="font-semibold text-neutral-900">Valid until</dt>
            <dd className={expiringSoon ? "text-red-600" : "text-neutral-700"}>{formatDate(offer.validUntil)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-neutral-900">Last checked</dt>
            <dd className="text-neutral-700">{formatDate(offer.lastCheckedAt)}</dd>
          </div>
        </dl>

        {/* CTA row — side by side to keep the card compact; navy = primary, emerald outline = secondary */}
        <div className="mt-auto flex gap-2">
          <Link
            className={buttonClasses({ variant: "primary" }) + " flex-1 whitespace-nowrap"}
            href={`/offers/${offer.id}`}
          >
            View details
          </Link>
          <a
            className={buttonClasses({ variant: "outline" }) + " flex-1 whitespace-nowrap"}
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
