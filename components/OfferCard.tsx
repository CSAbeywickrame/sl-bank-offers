import Link from "next/link";
import { getCategoryLabel } from "@/lib/offers/categories";
import type { Offer } from "@/lib/offers/types";

function formatDate(value: string | undefined): string {
  if (!value) return "Not specified";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not specified";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}

function isExpiringSoon(validUntil: string | undefined): boolean {
  if (!validUntil) return false;
  const date = new Date(validUntil);
  if (!Number.isFinite(date.getTime())) return false;
  const daysRemaining = (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return daysRemaining >= 0 && daysRemaining <= 7;
}

export function OfferCard({ offer }: { offer: Offer }) {
  const expiringSoon = isExpiringSoon(offer.validUntil);

  return (
    <article className="group flex h-full flex-col rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow duration-150 hover:shadow-md hover:border-slate-300 overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-teal-400 to-teal-600" />

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800 ring-1 ring-teal-100">
            {offer.bankName}
          </span>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-100">
            {getCategoryLabel(offer.category)}
          </span>
          {expiringSoon && (
            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-100">
              Expiring soon
            </span>
          )}
        </div>

        <div className="flex-1">
          {offer.merchant && (
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-teal-700">{offer.merchant}</p>
          )}
          <h2 className="text-base font-semibold leading-snug text-slate-900 group-hover:text-teal-800 transition-colors">
            {offer.title}
          </h2>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{offer.description}</p>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
          <div>
            <dt className="font-semibold text-slate-800">Valid until</dt>
            <dd className={expiringSoon ? "text-red-600 font-medium" : ""}>{formatDate(offer.validUntil)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-800">Last checked</dt>
            <dd>{formatDate(offer.lastCheckedAt)}</dd>
          </div>
        </dl>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            className="inline-flex flex-1 items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
            href={`/offers/${offer.id}`}
          >
            View details
          </Link>
          <a
            className="inline-flex flex-1 items-center justify-center rounded-lg border border-teal-700 px-4 py-2.5 text-sm font-semibold text-teal-800 hover:bg-teal-50 transition-colors"
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
