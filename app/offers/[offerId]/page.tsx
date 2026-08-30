import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { buttonClasses } from "@/components/ui/button";
import { getCategoryLabel } from "@/lib/offers/categories";
import { getOfferById } from "@/lib/offers/repository";
import { siteUrl } from "@/lib/site-config";

interface OfferDetailPageProps {
  params: Promise<{ offerId: string }>;
}

function formatDate(value: string | undefined): string {
  if (!value) return "Not specified";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not specified";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}

export async function generateMetadata({ params }: OfferDetailPageProps): Promise<Metadata> {
  const { offerId } = await params;
  const offer = await getOfferById(offerId);
  if (!offer) return {};

  const validityNote = offer.validUntil ? ` Valid until ${formatDate(offer.validUntil)}.` : "";
  const title = offer.title;
  const description = `${offer.description} — ${offer.bankName} credit card offer.${validityNote}`;

  return {
    title,
    description,
    openGraph: { title, description, url: `${siteUrl}/offers/${offerId}` },
    alternates: { canonical: `${siteUrl}/offers/${offerId}` },
  };
}

export default async function OfferDetailPage({ params }: OfferDetailPageProps) {
  const { offerId } = await params;
  const offer = await getOfferById(offerId);

  if (!offer) notFound();

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: offer.title, item: `${siteUrl}/offers/${offerId}` },
    ],
  };

  const offerJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Offer",
    name: offer.title,
    description: offer.description,
    url: `${siteUrl}/offers/${offerId}`,
    category: getCategoryLabel(offer.category),
    offeredBy: { "@type": "BankOrCreditUnion", name: offer.bankName },
    ...(offer.validFrom && { validFrom: offer.validFrom }),
    ...(offer.validUntil && { validThrough: offer.validUntil }),
    ...(offer.merchant && { seller: { "@type": "Organization", name: offer.merchant } }),
    dateModified: offer.lastCheckedAt,
  };

  return (
    <main
      className="mx-auto max-w-5xl px-4 py-8"
      style={{ display: "grid", gap: "32px" }}
    >
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={offerJsonLd} />

      <div style={{ display: "grid", gap: "16px" }}>
        <Link
          className="inline-flex items-center gap-1 text-sm font-semibold text-(--text-link) hover:underline"
          href="/"
        >
          ← Back to all offers
        </Link>

        {/* Dark hero panel */}
        <div className="rounded-xl bg-(--surface-inverse)" style={{ padding: "32px 28px" }}>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-(--text-on-inverse)">
              {offer.bankName}
            </span>
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold text-(--hero-highlight)"
              style={{ background: "var(--hero-eyebrow-bg)" }}
            >
              {getCategoryLabel(offer.category)}
            </span>
          </div>
          <h1
            className="mt-4 font-semibold text-(--text-on-inverse)"
            style={{ fontSize: "var(--fs-h1)", lineHeight: "var(--lh-tight)", letterSpacing: "var(--ls-tight)" }}
          >
            {offer.title}
          </h1>
          <p
            className="mt-4 max-w-3xl text-sm"
            style={{ lineHeight: "var(--lh-relaxed)", color: "var(--text-on-inverse-muted)" }}
          >
            {offer.description}
          </p>
        </div>
      </div>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        {/* Details card */}
        <article className="rounded-xl border border-(--border-subtle) bg-(--surface-card) p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-(--text-strong)">Offer details</h2>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-(--text-strong)">Bank</dt>
              <dd className="mt-1 text-(--text-body)">{offer.bankName}</dd>
            </div>
            {offer.cardName && (
              <div>
                <dt className="font-semibold text-(--text-strong)">Eligible card</dt>
                <dd className="mt-1 text-(--text-body)">{offer.cardName}</dd>
              </div>
            )}
            <div>
              <dt className="font-semibold text-(--text-strong)">Category</dt>
              <dd className="mt-1 text-(--text-body)">{getCategoryLabel(offer.category)}</dd>
            </div>
            {offer.merchant && (
              <div>
                <dt className="font-semibold text-(--text-strong)">Merchant</dt>
                <dd className="mt-1 text-(--text-body)">{offer.merchant}</dd>
              </div>
            )}
            {offer.location && (
              <div>
                <dt className="font-semibold text-(--text-strong)">Location</dt>
                <dd className="mt-1 text-(--text-body)">{offer.location}</dd>
              </div>
            )}
            <div>
              <dt className="font-semibold text-(--text-strong)">Valid until</dt>
              <dd className="mt-1 text-(--text-body)">{formatDate(offer.validUntil)}</dd>
            </div>
            <div>
              <dt className="font-semibold text-(--text-strong)">Last checked</dt>
              <dd className="mt-1 text-(--text-body)">{formatDate(offer.lastCheckedAt)}</dd>
            </div>
          </dl>
        </article>

        {/* Official links sidebar */}
        <aside
          className="grid gap-4 rounded-xl border border-(--border-subtle) bg-(--surface-muted) p-6"
          style={{ alignContent: "start" }}
        >
          <h2 className="text-lg font-semibold text-(--text-strong)">Official links</h2>
          <p className="text-sm leading-(--lh-relaxed) text-(--text-muted)">
            Use the official bank source to confirm the latest eligibility, dates, and exclusions before using the offer.
          </p>
          <a
            className={buttonClasses({ variant: "accent", size: "lg", fullWidth: true })}
            href={offer.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            View at bank
          </a>
          <a
            className={buttonClasses({ variant: "outline", size: "lg", fullWidth: true })}
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
