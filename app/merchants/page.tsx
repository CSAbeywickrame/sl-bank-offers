import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { StatTile } from "@/components/StatTile";
import { getMerchantSummaries, type MerchantSummary } from "@/lib/offers/merchants";
import { siteName, siteUrl } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Every Merchant with a Card Offer",
  description:
    "Browse every shop, hotel and restaurant with a Sri Lankan card offer — and see which merchants are discounted by more than one bank, so you know which card to reach for.",
  openGraph: {
    title: "Every Merchant with a Card Offer",
    description: "Browse every merchant with a Sri Lankan bank card offer.",
    url: `${siteUrl}/merchants`,
  },
  alternates: { canonical: `${siteUrl}/merchants` },
};

export default async function MerchantsPage() {
  const merchants = await getMerchantSummaries();
  // Merchants several banks discount are the ones where the choice of card actually changes what
  // you pay, so they lead. The rest are still worth listing, just not worth leading with.
  const multiBank = merchants.filter((merchant) => merchant.bankCount > 1);
  const singleBank = merchants.filter((merchant) => merchant.bankCount === 1);

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Merchants", item: `${siteUrl}/merchants` },
    ],
  };

  // Only the compared-across-banks merchants go in the ItemList: it is a finite, meaningful set,
  // where listing 1,300 single-bank shops would be noise to a crawler and to a reader.
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Merchants with offers at more than one bank — ${siteName}`,
    numberOfItems: multiBank.length,
    itemListElement: multiBank.slice(0, 100).map((merchant, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: merchant.name,
      url: `${siteUrl}/merchants/${merchant.slug}`,
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
          <div className="hero-orb hero-orb-gold" />
          <div className="hero-dots" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-12">
          <nav aria-label="Breadcrumb" className="mb-6 text-xs" style={{ color: "var(--text-on-inverse-muted)" }}>
            <ol className="flex items-center gap-1.5">
              <li>
                <Link href="/" className="hover:underline">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="font-medium" style={{ color: "var(--text-on-inverse)" }}>
                Merchants
              </li>
            </ol>
          </nav>
          <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <div className="max-w-2xl">
              <h1 className="font-bold" style={{ fontSize: "44px", lineHeight: "var(--lh-tight)", letterSpacing: "var(--ls-tight)" }}>
                Where your <span style={{ color: "var(--hero-highlight)" }}>cards save you</span>
              </h1>
              <p className="mt-4 text-base" style={{ lineHeight: "var(--lh-relaxed)", color: "var(--text-on-inverse-muted)" }}>
                Every shop, hotel and restaurant with a live card offer. The ones at the top run
                promotions with more than one bank — worth checking which of your cards saves you most.
              </p>
            </div>
            <StatTile value={multiBank.length} label="at 2+ banks" className="min-w-45" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8">
        <h2 className="text-xl font-semibold text-(--text-strong)">
          Offers at more than one bank{" "}
          <span className="font-normal text-(--text-muted)">({multiBank.length})</span>
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {multiBank.map((merchant) => (
            <MerchantCard key={merchant.slug} merchant={merchant} />
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12">
        <h2 className="text-xl font-semibold text-(--text-strong)">
          All other merchants <span className="font-normal text-(--text-muted)">({singleBank.length})</span>
        </h2>
        {/* A flat link list, not cards: with over a thousand entries the bank and offer counts are
            all "1", so cards would be a page of identical boxes. */}
        <ul className="mt-4 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {singleBank.map((merchant) => (
            <li key={merchant.slug}>
              <Link
                href={`/merchants/${merchant.slug}`}
                className="block truncate py-1 text-sm text-(--text-body) hover:text-(--text-link) hover:underline"
              >
                {merchant.name}
                {merchant.bestDiscountPct !== undefined && (
                  <span className="ml-1.5 text-xs font-semibold text-(--text-link)">
                    {merchant.bestDiscountPct}%
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function MerchantCard({ merchant }: { merchant: MerchantSummary }) {
  return (
    <li>
      <Link
        href={`/merchants/${merchant.slug}`}
        className="group flex h-full items-start justify-between gap-3 rounded-lg border border-(--border-subtle) bg-(--surface-card) px-4 py-3 shadow-sm transition-[box-shadow,border-color,transform] duration-(--motion-fast) ease-out hover:-translate-y-0.5 hover:border-(--border-default) hover:shadow-md motion-reduce:hover:translate-y-0"
      >
        <span className="min-w-0">
          <span className="block truncate font-semibold text-(--text-strong) group-hover:text-(--text-link)">
            {merchant.name}
          </span>
          <span className="mt-0.5 block text-xs text-(--text-muted)">
            {merchant.bankCount} banks · {merchant.offerCount} offer{merchant.offerCount === 1 ? "" : "s"}
          </span>
        </span>
        {merchant.bestDiscountPct !== undefined && (
          <span className="shrink-0 text-lg font-bold leading-none text-(--text-link)">
            {merchant.bestDiscountPct}%
          </span>
        )}
      </Link>
    </li>
  );
}
