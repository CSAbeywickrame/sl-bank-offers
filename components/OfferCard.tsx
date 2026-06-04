import { getCategoryLabel } from "@/lib/offers/categories";
import type { Offer } from "@/lib/offers/types";

function formatDate(value: string | undefined): string {
  if (!value) {
    return "Not specified";
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "Not specified";
  }

  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}

export function OfferCard({ offer }: { offer: Offer }) {
  return (
    <article className="grid min-h-[22rem] gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 self-start">
        <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">{offer.bankName}</span>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{getCategoryLabel(offer.category)}</span>
      </div>

      <div>
        <h2 className="text-lg font-semibold leading-6 tracking-normal text-slate-950">{offer.title}</h2>
        <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-600">{offer.description}</p>
      </div>

      <dl className="grid gap-2 text-sm text-slate-600">
        {offer.merchant ? (
          <div>
            <dt className="font-semibold text-slate-800">Merchant</dt>
            <dd>{offer.merchant}</dd>
          </div>
        ) : null}
        <div>
          <dt className="font-semibold text-slate-800">Valid until</dt>
          <dd>{formatDate(offer.validUntil)}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-800">Last checked</dt>
          <dd>{formatDate(offer.lastCheckedAt)}</dd>
        </div>
      </dl>

      <a
        className="mt-auto inline-flex h-10 items-center justify-center rounded-md border border-teal-700 px-4 text-sm font-semibold text-teal-800 hover:bg-teal-50"
        href={offer.sourceUrl}
        target="_blank"
        rel="noreferrer"
      >
        View at bank
      </a>
    </article>
  );
}
