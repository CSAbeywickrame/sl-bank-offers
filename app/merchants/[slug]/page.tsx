import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { OfferCard } from "@/components/OfferCard";
import { getCategoryLabel } from "@/lib/offers/categories";
import { getOfferHighlight } from "@/lib/offers/highlight";
import {
  getGroupSiblings,
  getMerchantBySlug,
  getMerchantOffers,
  getMerchantSummaries
} from "@/lib/offers/merchants";
import { siteUrl } from "@/lib/site-config";

interface MerchantPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return (await getMerchantSummaries()).map((merchant) => ({ slug: merchant.slug }));
}

function formatDate(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}

// "8 live offers across 6 banks · best is 25% off" — the summary that tells someone whether this
// page is worth reading before they read it.
function summarise(offerCount: number, bankCount: number, bestDiscountPct?: number): string {
  const offers = `${offerCount} live offer${offerCount === 1 ? "" : "s"}`;
  const banks = bankCount > 1 ? ` across ${bankCount} banks` : "";
  const best = bestDiscountPct !== undefined ? ` · best is ${bestDiscountPct}% off` : "";
  return `${offers}${banks}${best}`;
}

export async function generateMetadata({ params }: MerchantPageProps): Promise<Metadata> {
  const { slug } = await params;
  const merchant = await getMerchantBySlug(slug);
  if (!merchant) return {};

  const title = `${merchant.name} Card Offers`;
  const description = `${summarise(merchant.offerCount, merchant.bankCount, merchant.bestDiscountPct)}. Compare ${merchant.name} discounts across ${merchant.banks.join(", ")}.`;

  return {
    title,
    description,
    openGraph: { title, description, url: `${siteUrl}/merchants/${slug}` },
    alternates: { canonical: `${siteUrl}/merchants/${slug}` },
  };
}

export default async function MerchantPage({ params }: MerchantPageProps) {
  const { slug } = await params;
  let merchant = await getMerchantBySlug(slug);

  // Alias slugs never reach here: next.config redirects them to the canonical merchant before the
  // route runs.
  if (!merchant) notFound();

  const offers = await getMerchantOffers(slug);
  const siblings = await getGroupSiblings(slug);
  const headline = summarise(merchant.offerCount, merchant.bankCount, merchant.bestDiscountPct);

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Merchants", item: `${siteUrl}/merchants` },
      { "@type": "ListItem", position: 3, name: merchant.name, item: `${siteUrl}/merchants/${slug}` },
    ],
  };

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${merchant.name} card offers`,
    numberOfItems: offers.length,
    itemListElement: offers.map((offer, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Offer",
        name: offer.title,
        url: `${siteUrl}/offers/${offer.id}`,
        offeredBy: { "@type": "BankOrCreditUnion", name: offer.bankName },
        ...(offer.validUntil && { validThrough: offer.validUntil }),
      },
    })),
  };

  return (
    <main>
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={itemListJsonLd} />

      <section
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(120deg, var(--hero-bg) 58%, var(--hero-bg-2))", color: "var(--text-on-inverse)" }}
      >
        <div className="absolute inset-0" aria-hidden="true">
          <div className="hero-orb hero-orb-emerald" />
          <div className="hero-dots" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-12">
          <nav aria-label="Breadcrumb" className="mb-6 text-xs" style={{ color: "var(--text-on-inverse-muted)" }}>
            <ol className="flex flex-wrap items-center gap-1.5">
              <li>
                <Link href="/" className="hover:underline">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href="/merchants" className="hover:underline">
                  Merchants
                </Link>
              </li>
            </ol>
          </nav>
          <h1 className="font-bold" style={{ fontSize: "44px", lineHeight: "var(--lh-tight)", letterSpacing: "var(--ls-tight)" }}>
            {merchant.name}
          </h1>
          <p className="mt-3 text-base" style={{ color: "var(--text-on-inverse-muted)" }}>
            {headline}
          </p>
        </div>
      </section>

      {/* The comparison this page exists for: one row per offer, so a cardholder can find their own
          bank and see at a glance whether a different card would do better. */}
      {merchant.bankCount > 1 && (
        <section className="mx-auto max-w-7xl px-4 pt-8">
          <h2 className="text-xl font-semibold text-(--text-strong)">Compare by bank</h2>
          <div className="mt-4 overflow-x-auto rounded-lg border border-(--border-subtle)">
            <table className="w-full min-w-xl border-collapse text-sm">
              <thead>
                <tr className="bg-(--surface-muted) text-left">
                  <Th>Bank</Th>
                  <Th>Offer</Th>
                  <Th align="right">Saving</Th>
                  <Th align="right">Until</Th>
                </tr>
              </thead>
              <tbody>
                {offers.map((offer) => {
                  const highlight = getOfferHighlight(offer);
                  return (
                    <tr key={offer.id} className="border-t border-(--border-subtle)">
                      <Td className="font-medium text-(--text-strong)">{offer.bankShortName ?? offer.bankName}</Td>
                      <Td>
                        <Link
                          href={`/offers/${offer.id}`}
                          className="text-(--text-link) hover:underline"
                        >
                          {offer.title}
                        </Link>
                      </Td>
                      <Td align="right" className="whitespace-nowrap font-semibold text-(--text-strong)">
                        {highlight.value ? `${highlight.value} ${highlight.label}` : highlight.label}
                      </Td>
                      <Td align="right" className="whitespace-nowrap text-(--text-muted)">
                        {formatDate(offer.validUntil)}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 py-8">
        <h2 className="text-xl font-semibold text-(--text-strong)">
          {merchant.bankCount > 1 ? "Every offer in full" : `Offers at ${merchant.name}`}
        </h2>
        <ul className="mt-4 grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {offers.map((offer) => (
            <li key={offer.id} className="h-full">
              <OfferCard offer={offer} />
            </li>
          ))}
        </ul>
      </section>

      {/* Same brand, separate merchants — an invitation to explore, never a claim that these offers
          apply at each other's properties. */}
      {siblings.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-12">
          <h2 className="text-xl font-semibold text-(--text-strong)">More from {merchant.group}</h2>
          <ul className="mt-4 flex flex-wrap gap-2" role="list">
            {siblings.map((sibling) => (
              <li key={sibling.slug}>
                <Link
                  href={`/merchants/${sibling.slug}`}
                  className="inline-flex items-center gap-2 rounded-(--radius-pill) border border-(--border-subtle) bg-(--surface-card) px-3 py-1.5 text-sm text-(--text-body) transition-colors duration-(--motion-fast) hover:border-(--border-default) hover:text-(--text-link)"
                >
                  {sibling.name}
                  {sibling.bestDiscountPct !== undefined && (
                    <span className="text-xs font-semibold text-(--text-link)">{sibling.bestDiscountPct}%</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 pb-12">
        <p className="text-sm text-(--text-muted)">
          Categories: {[...new Set(offers.map((offer) => getCategoryLabel(offer.category)))].join(", ")}
        </p>
      </section>
    </main>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th
      scope="col"
      className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-(--ls-wide) text-(--text-muted) ${align === "right" ? "text-right" : ""}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  className = ""
}: {
  children: React.ReactNode;
  align?: "right";
  className?: string;
}) {
  return <td className={`px-4 py-3 ${align === "right" ? "text-right" : ""} ${className}`}>{children}</td>;
}

// A merchant that appears between builds (a new offer, a refreshed alias table) renders on demand
// rather than 404ing.
export const dynamicParams = true;
