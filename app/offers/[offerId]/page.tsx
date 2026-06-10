import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategoryLabel } from "@/lib/offers/categories";
import { getOfferById } from "@/lib/offers/repository";

interface OfferDetailPageProps {
  params: Promise<{ offerId: string }>;
}

// Formats an ISO date string into a human-readable medium date, or returns "Not specified"
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

// Individual offer detail page showing full metadata and official bank links
export default async function OfferDetailPage({ params }: OfferDetailPageProps) {
  const { offerId } = await params;
  const offer = await getOfferById(offerId);

  if (!offer) {
    notFound();
  }

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-4 py-8">
      <div className="grid gap-4">
        <Link className="text-sm font-medium text-teal-800 hover:text-teal-900" href="/">
          Back to all offers
        </Link>

        <div className="rounded-2xl bg-slate-950 px-6 py-8 text-white">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">{offer.bankName}</span>
            <span className="rounded-full bg-teal-400/15 px-3 py-1 text-xs font-semibold text-teal-100">{getCategoryLabel(offer.category)}</span>
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-normal">{offer.title}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200">{offer.description}</p>
        </div>
      </div>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Offer details</h2>
          <dl className="mt-5 grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-slate-900">Bank</dt>
              <dd className="mt-1">{offer.bankName}</dd>
            </div>
            {offer.cardName ? (
              <div>
                <dt className="font-semibold text-slate-900">Eligible card</dt>
                <dd className="mt-1">{offer.cardName}</dd>
              </div>
            ) : null}
            <div>
              <dt className="font-semibold text-slate-900">Category</dt>
              <dd className="mt-1">{getCategoryLabel(offer.category)}</dd>
            </div>
            {offer.merchant ? (
              <div>
                <dt className="font-semibold text-slate-900">Merchant</dt>
                <dd className="mt-1">{offer.merchant}</dd>
              </div>
            ) : null}
            {offer.location ? (
              <div>
                <dt className="font-semibold text-slate-900">Location</dt>
                <dd className="mt-1">{offer.location}</dd>
              </div>
            ) : null}
            <div>
              <dt className="font-semibold text-slate-900">Valid until</dt>
              <dd className="mt-1">{formatDate(offer.validUntil)}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">Last checked</dt>
              <dd className="mt-1">{formatDate(offer.lastCheckedAt)}</dd>
            </div>
          </dl>
        </article>

        <aside className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-lg font-semibold text-slate-950">Official links</h2>
          <p className="text-sm leading-6 text-slate-600">
            Use the official bank source to confirm the latest eligibility, dates, and exclusions before using the offer.
          </p>
          <a
            className="inline-flex h-11 items-center justify-center rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800"
            href={offer.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            View at bank
          </a>
          <a
            className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            href={offer.terms ?? offer.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            View terms
          </a>
        </aside>
      </section>
    </main>
  );
}
