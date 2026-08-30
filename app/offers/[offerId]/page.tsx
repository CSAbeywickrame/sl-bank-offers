import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { RelatedOffers } from "@/components/RelatedOffers";
import { buttonClasses } from "@/components/ui/button";
import { getCategoryLabel } from "@/lib/offers/categories";
import { formatCardEligibility, formatLkr, formatValidDays, getOfferHighlight } from "@/lib/offers/highlight";
import { getRelatedOffers, resolveMerchant } from "@/lib/offers/merchants";
import { getActiveOffers, getOfferById } from "@/lib/offers/repository";
import { siteUrl } from "@/lib/site-config";

const RELATED_LIMIT = 6;

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

  const highlight = getOfferHighlight(offer);
  const eligibility = formatCardEligibility(offer);
  const days = formatValidDays(offer.validDays);

  // The two questions a detail page otherwise leaves open: could another card do better here, and
  // what else does this bank discount in the same category.
  const merchantSlug = offer.merchant ? resolveMerchant(offer.merchant)?.slug : undefined;
  const sameMerchant = merchantSlug ? (await getRelatedOffers(merchantSlug, offer.id)).slice(0, RELATED_LIMIT) : [];
  const sameBankCategory = (await getActiveOffers())
    .filter(
      (other) =>
        other.id !== offer.id &&
        other.bankId === offer.bankId &&
        other.category === offer.category &&
        !sameMerchant.some((related) => related.id === other.id)
    )
    .sort((a, b) => (b.discountPct ?? -1) - (a.discountPct ?? -1))
    .slice(0, RELATED_LIMIT);

  const bankName = offer.bankShortName ?? offer.bankName;
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: bankName, item: `${siteUrl}/banks/${offer.bankId}` },
      { "@type": "ListItem", position: 3, name: offer.title, item: `${siteUrl}/offers/${offerId}` },
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
    ...(offer.discountPct !== undefined && {
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        priceType: "https://schema.org/SalePrice",
        description: `${highlight.value} ${highlight.label}`,
      },
    }),
    dateModified: offer.lastCheckedAt,
  };

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-4 py-8">
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={offerJsonLd} />

      <div className="grid gap-4">
        <nav aria-label="Breadcrumb" className="text-xs text-(--text-muted)">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/" className="hover:underline">
                All offers
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href={`/banks/${offer.bankId}`} className="hover:underline">
                {bankName}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href={`/categories/${offer.category}`} className="hover:underline">
                {getCategoryLabel(offer.category)}
              </Link>
            </li>
          </ol>
        </nav>

        <div className="rounded-xl bg-(--surface-inverse) px-7 py-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
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
            </div>
            {/* The saving, repeated large: someone arriving from search should not have to read the
                title to learn what the offer is worth. */}
            <p className="shrink-0 text-right">
              <span className="block font-bold leading-none text-(--hero-highlight)" style={{ fontSize: "44px" }}>
                {highlight.value ?? highlight.label}
              </span>
              {highlight.value && (
                <span className="mt-1 block text-sm font-semibold" style={{ color: "var(--text-on-inverse-muted)" }}>
                  {highlight.label}
                </span>
              )}
            </p>
          </div>
          <p
            className="mt-4 max-w-3xl text-sm"
            style={{ lineHeight: "var(--lh-relaxed)", color: "var(--text-on-inverse-muted)" }}
          >
            {offer.description}
          </p>
        </div>
      </div>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <article className="rounded-xl border border-(--border-subtle) bg-(--surface-card) p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-(--text-strong)">Offer details</h2>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <Detail label="Bank" value={offer.bankName} />
            {/* Extracted eligibility beats the stored card record: "Visa Infinite · Credit" is what
                the bank actually wrote, while cardName is a coarse per-bank default. */}
            <Detail label="Eligible cards" value={eligibility ?? offer.cardName ?? "All cards"} />
            <Detail label="Category" value={getCategoryLabel(offer.category)} />
            {offer.merchant && <Detail label="Merchant" value={offer.merchant} />}
            {offer.installmentMonths !== undefined && (
              <Detail label="Instalment term" value={`Up to ${offer.installmentMonths} months`} />
            )}
            {offer.minSpend !== undefined && <Detail label="Minimum spend" value={formatLkr(offer.minSpend)} />}
            {offer.maxDiscountAmount !== undefined && (
              <Detail label="Maximum saving" value={formatLkr(offer.maxDiscountAmount)} />
            )}
            {days && <Detail label="Valid days" value={days} />}
            {offer.location && <Detail label="Location" value={offer.location} />}
            <Detail label="Valid until" value={formatDate(offer.validUntil)} />
            <Detail label="Last checked" value={formatDate(offer.lastCheckedAt)} />
          </dl>
          {offer.eligibilityNote && (
            <p className="mt-5 rounded-(--radius-md) bg-(--surface-muted) px-4 py-3 text-sm text-(--text-body)">
              {offer.eligibilityNote}
            </p>
          )}
        </article>

        <aside className="grid content-start gap-4 rounded-xl border border-(--border-subtle) bg-(--surface-muted) p-6">
          <h2 className="text-lg font-semibold text-(--text-strong)">Official links</h2>
          <p className="text-sm leading-(--lh-relaxed) text-(--text-muted)">
            Confirm the latest eligibility, dates, and exclusions with the bank before you spend.
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

      <RelatedOffers
        heading={offer.merchant ? `Other cards at ${offer.merchant}` : "Other cards at this merchant"}
        description="The same merchant, a different bank — worth checking which of your cards saves you most."
        offers={sameMerchant}
      />

      <RelatedOffers
        heading={`More ${getCategoryLabel(offer.category)} offers from ${bankName}`}
        offers={sameBankCategory}
        showBank={false}
      />
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-semibold text-(--text-strong)">{label}</dt>
      <dd className="mt-1 text-(--text-body)">{value}</dd>
    </div>
  );
}
