import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
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
          className="inline-flex items-center gap-1 text-sm font-semibold hover:underline"
          href="/"
          style={{ color: "#047857" }}
        >
          ← Back to all offers
        </Link>

        {/* Dark hero panel */}
        <div style={{ background: "#08271c", borderRadius: "16px", padding: "32px 28px" }}>
          <div className="flex flex-wrap gap-2">
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: "rgba(255,255,255,0.12)", color: "#fff" }}
            >
              {offer.bankName}
            </span>
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: "rgba(212,175,95,0.18)", color: "#e1c46e" }}
            >
              {getCategoryLabel(offer.category)}
            </span>
          </div>
          <h1
            className="mt-4 font-semibold text-white"
            style={{ fontSize: "30px", lineHeight: 1.15, letterSpacing: "-0.02em" }}
          >
            {offer.title}
          </h1>
          <p className="mt-4 max-w-3xl text-sm" style={{ lineHeight: 1.7, color: "rgba(255,255,255,0.78)" }}>
            {offer.description}
          </p>
        </div>
      </div>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        {/* Details card */}
        <article
          className="rounded-2xl bg-white p-6"
          style={{ border: "1px solid #dde7e1", boxShadow: "0 1px 2px rgb(15 23 42 / 5%)", borderRadius: "16px" }}
        >
          <h2 className="font-semibold" style={{ fontSize: "18px", color: "#16201b" }}>
            Offer details
          </h2>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-semibold" style={{ color: "#16201b" }}>Bank</dt>
              <dd className="mt-1" style={{ color: "#3b4a43" }}>{offer.bankName}</dd>
            </div>
            {offer.cardName && (
              <div>
                <dt className="font-semibold" style={{ color: "#16201b" }}>Eligible card</dt>
                <dd className="mt-1" style={{ color: "#3b4a43" }}>{offer.cardName}</dd>
              </div>
            )}
            <div>
              <dt className="font-semibold" style={{ color: "#16201b" }}>Category</dt>
              <dd className="mt-1" style={{ color: "#3b4a43" }}>{getCategoryLabel(offer.category)}</dd>
            </div>
            {offer.merchant && (
              <div>
                <dt className="font-semibold" style={{ color: "#16201b" }}>Merchant</dt>
                <dd className="mt-1" style={{ color: "#3b4a43" }}>{offer.merchant}</dd>
              </div>
            )}
            {offer.location && (
              <div>
                <dt className="font-semibold" style={{ color: "#16201b" }}>Location</dt>
                <dd className="mt-1" style={{ color: "#3b4a43" }}>{offer.location}</dd>
              </div>
            )}
            <div>
              <dt className="font-semibold" style={{ color: "#16201b" }}>Valid until</dt>
              <dd className="mt-1" style={{ color: "#3b4a43" }}>{formatDate(offer.validUntil)}</dd>
            </div>
            <div>
              <dt className="font-semibold" style={{ color: "#16201b" }}>Last checked</dt>
              <dd className="mt-1" style={{ color: "#3b4a43" }}>{formatDate(offer.lastCheckedAt)}</dd>
            </div>
          </dl>
        </article>

        {/* Official links sidebar */}
        <aside
          className="grid gap-4 p-6"
          style={{
            background: "#e9f1ec",
            border: "1px solid #dde7e1",
            borderRadius: "16px",
            alignContent: "start",
          }}
        >
          <h2 className="font-semibold" style={{ fontSize: "18px", color: "#16201b" }}>
            Official links
          </h2>
          <p className="text-sm leading-6" style={{ color: "#6a7d73" }}>
            Use the official bank source to confirm the latest eligibility, dates, and exclusions before using the offer.
          </p>
          <a
            className="inline-flex items-center justify-center text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800"
            href={offer.sourceUrl}
            target="_blank"
            rel="noreferrer"
            style={{ height: "44px", borderRadius: "8px", background: "#047857", padding: "0 20px" }}
          >
            View at bank
          </a>
          <a
            className="inline-flex items-center justify-center text-sm font-semibold transition-colors duration-150 hover:bg-emerald-50"
            href={offer.terms ?? offer.sourceUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              height: "44px",
              borderRadius: "8px",
              border: "1px solid #047857",
              color: "#047857",
              padding: "0 20px",
              background: "#fff",
            }}
          >
            View terms
          </a>
        </aside>
      </section>
    </main>
  );
}
